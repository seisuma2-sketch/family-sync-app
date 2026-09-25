"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  ShoppingCart,
  Clock,
  LogOut,
  Users,
  Settings,
  User,
  X,
  Menu,
  Gift,
  Trash2,
  Plus,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import clsx from "clsx";

type WishItem = { id: string; text: string };
type UserProfile = {
  displayName: string;
  emoji: string;
  photoUrl: string | null;
  wishlist: WishItem[];
};

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>({
    displayName: "メンバー",
    emoji: "👤",
    photoUrl: null,
    wishlist: [],
  });

  // モバイル用ハンバーガーメニュー（ドロワー）の状態
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // プロフィールモーダル用の状態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [newWish, setNewWish] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        const unsubscribeDb = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile({
              displayName: data.displayName || "メンバー",
              emoji: data.emoji || "👤",
              photoUrl: data.photoUrl || null,
              wishlist: data.wishlist || [],
            });
          }
        });
        return () => unsubscribeDb();
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error(error);
    }
  };

  const openProfileModal = () => {
    setEditName(profile.displayName);
    setEditEmoji(profile.emoji);
    setEditPhotoUrl(profile.photoUrl);
    setIsModalOpen(true);
  };

  const saveProfileInfo = async (
    name = editName,
    emoji = editEmoji,
    photoUrl = editPhotoUrl
  ) => {
    if (!userId) return;
    await setDoc(
      doc(db, "users", userId),
      {
        displayName: name || "メンバー",
        emoji: emoji || "👤",
        photoUrl: photoUrl,
      },
      { merge: true }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 160;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height *= MAX_SIZE / width));
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width *= MAX_SIZE / height));
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
          setEditPhotoUrl(compressedDataUrl);
          saveProfileInfo(editName, editEmoji, compressedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAddWish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !newWish.trim()) return;
    await setDoc(
      doc(db, "users", userId),
      {
        wishlist: [
          ...profile.wishlist,
          { id: Date.now().toString(), text: newWish.trim() },
        ],
      },
      { merge: true }
    );
    setNewWish("");
  };

  const handleDeleteWish = async (wishId: string) => {
    if (!userId) return;
    const updatedList = profile.wishlist.filter((w) => w.id !== wishId);
    await setDoc(
      doc(db, "users", userId),
      { wishlist: updatedList },
      { merge: true }
    );
  };

  const navItems = [
    { href: "/", label: "カレンダー", icon: Calendar },
    { href: "/shopping", label: "買い物リスト", icon: ShoppingCart },
    { href: "/history", label: "献立履歴", icon: Clock },
    { href: "/settings", label: "メンバー管理", icon: Users },
  ];

  return (
    <>
      {/* ＝＝＝ スマホ用固定ハンバーガーメニューボタン（右上） ＝＝＝ */}
      <div className="md:hidden fixed top-0 right-0 z-40 p-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] pointer-events-none">
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-2xl bg-black/45 backdrop-blur-xl border border-white/20 text-white shadow-lg active:scale-95 transition-all hover:bg-white/10"
          aria-label="メニューを開く"
        >
          <Menu className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* ＝＝＝ スマホ用スライドメニュー（ドロワー） ＝＝＝ */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* 背景オーバーレイ */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />

            {/* ドロワーパネル */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 inset-y-0 w-80 max-w-[85vw] bg-neutral-900/95 backdrop-blur-2xl border-l border-white/10 p-6 flex flex-col pt-[calc(env(safe-area-inset-top,0px)+20px)] pb-[calc(env(safe-area-inset-bottom,0px)+20px)] shadow-2xl text-white"
            >
              {/* ヘッダー */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <span className="font-extrabold text-lg tracking-tight text-white">メニュー</span>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 transition-all"
                  aria-label="閉じる"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* マイページ・プロフィールカード */}
              <div className="py-6">
                <div className="flex items-center space-x-3 mb-4 p-3 bg-white/5 border border-white/10 rounded-2xl">
                  {profile.photoUrl ? (
                    <img
                      src={profile.photoUrl}
                      alt="Profile"
                      className="w-12 h-12 rounded-full object-cover border border-white/20 shadow-md"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-2xl shadow-inner">
                      {profile.emoji}
                    </div>
                  )}
                  <div className="overflow-hidden flex-1">
                    <p className="font-bold text-base text-white truncate">{profile.displayName}</p>
                    <p className="text-xs text-emerald-400 font-medium">ログイン中</p>
                  </div>
                </div>

                {/* マイページ（プロフィール設定）ボタン */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    openProfileModal();
                  }}
                  className="w-full flex items-center justify-between p-3.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-2xl text-emerald-300 font-bold transition-all active:scale-95 shadow-sm"
                >
                  <div className="flex items-center space-x-2.5">
                    <User className="w-5 h-5" />
                    <span>マイページ（設定）</span>
                  </div>
                  <Settings className="w-4 h-4 opacity-70" />
                </button>
              </div>

              {/* 家族設定リンク */}
              <div className="space-y-1 py-4 border-t border-white/10">
                <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider px-1 mb-2">メニュー</p>
                <Link
                  href="/settings"
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center space-x-3 p-3 rounded-xl hover:bg-white/10 text-white/90 transition-colors font-semibold text-sm"
                >
                  <Users className="w-5 h-5 text-emerald-400" />
                  <span>メンバー管理（家族共有）</span>
                </Link>
              </div>

              {/* 最下部：ログアウトボタン */}
              <div className="mt-auto pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center justify-center space-x-2 p-3.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-2xl font-bold transition-all active:scale-95 shadow-sm"
                >
                  <LogOut className="w-5 h-5" />
                  <span>ログアウト</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ＝＝＝ PC用サイドバー ＝＝＝ */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-black/20 backdrop-blur-xl border-r border-white/10 shadow-[10px_0_30px_rgba(0,0,0,0.3)] z-40 hidden md:flex flex-col">
        <div className="p-8">
          <h1 className="text-2xl font-extrabold text-white tracking-tight drop-shadow-md">
            Family Sync
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center space-x-3 px-4 py-3.5 rounded-2xl transition-all font-bold",
                  isActive
                    ? "bg-white/20 text-white border border-white/20 shadow-lg"
                    : "text-white/70 border border-transparent hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* サイドバー下部：プロフィール表示エリア */}
        <div className="p-4 mt-auto space-y-2 border-t border-white/10 bg-black/10">
          <button
            onClick={openProfileModal}
            className="w-full flex items-center p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group"
          >
            {profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover border border-white/20 shadow-inner group-hover:scale-110 transition-transform"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                {profile.emoji}
              </div>
            )}
            <div className="ml-3 text-left flex-1 overflow-hidden">
              <p className="text-sm font-bold text-white truncate">
                {profile.displayName}
              </p>
              <p className="text-[10px] text-emerald-400 font-bold mt-0.5">
                プロフィール設定
              </p>
            </div>
            <Settings className="w-4 h-4 text-white/30 group-hover:text-white/80 transition-colors" />
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-transparent hover:bg-red-500/20 hover:text-red-400 border border-transparent rounded-xl transition-all font-bold text-white/50 text-sm active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>ログアウト</span>
          </button>
        </div>
      </aside>

      {/* ＝＝＝ スマホ用ボトムナビゲーション（4つのすっきりタブ） ＝＝＝ */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-black/45 backdrop-blur-2xl border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.4)] z-40 pb-[calc(env(safe-area-inset-bottom,0px))]">
        <div className="flex justify-around items-center h-16 px-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-all rounded-xl",
                  isActive
                    ? "text-emerald-400 font-extrabold"
                    : "text-white/50 hover:text-white"
                )}
              >
                <Icon
                  className={clsx(
                    "w-5 h-5",
                    isActive && "drop-shadow-md scale-110 transition-transform text-emerald-400"
                  )}
                />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ＝＝＝ プロフィール設定モーダル ＝＝＝ */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0a1510]/90 backdrop-blur-2xl border border-white/20 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                <h3 className="font-extrabold text-lg text-white">マイプロフィール</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <div className="flex flex-col items-center mb-8">
                  <p className="text-xs text-white/50 mb-4">
                    アイコンをタップして写真をアップロード
                  </p>

                  {/* 画像アップロード用アイコン */}
                  <div className="flex items-center gap-4">
                    <div
                      className="relative group cursor-pointer w-24 h-24 rounded-full overflow-hidden border-2 border-white/20 shadow-inner flex items-center justify-center bg-black/40 hover:border-emerald-400 transition-all"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {editPhotoUrl ? (
                        <img
                          src={editPhotoUrl}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl">{editEmoji}</span>
                      )}
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    {/* 画像がある時だけ「写真を削除して絵文字に戻す」ボタンを表示 */}
                    {editPhotoUrl && (
                      <button
                        onClick={() => {
                          setEditPhotoUrl(null);
                          saveProfileInfo(editName, editEmoji, null);
                        }}
                        className="text-xs text-red-400 hover:bg-red-400/10 px-2 py-1 rounded-md transition-colors"
                      >
                        写真を削除
                      </button>
                    )}
                  </div>

                  {/* 隠しファイル入力 */}
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleImageChange}
                  />

                  {/* もし写真がない場合は、絵文字の入力も許可 */}
                  {!editPhotoUrl && (
                    <div className="mt-4 flex items-center space-x-2 bg-black/30 px-3 py-1.5 rounded-xl border border-white/10">
                      <span className="text-xs text-white/50">絵文字:</span>
                      <input
                        type="text"
                        value={editEmoji}
                        onChange={(e) => setEditEmoji(e.target.value)}
                        onBlur={() => saveProfileInfo()}
                        className="w-8 text-center text-white bg-transparent text-lg outline-none"
                        maxLength={2}
                      />
                    </div>
                  )}

                  {/* 文字色を text-white に */}
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => saveProfileInfo()}
                    placeholder="名前を入力"
                    className="mt-6 text-2xl font-extrabold text-white text-center bg-transparent border-b-2 border-white/20 focus:border-emerald-400 hover:border-white/40 transition-all outline-none pb-1 w-3/4 placeholder:text-white/20"
                  />
                </div>

                {/* 欲しいものリスト */}
                <div>
                  <div className="flex items-center space-x-2 mb-4 text-pink-400">
                    <Gift className="w-5 h-5" />
                    <h4 className="font-bold">欲しいものリスト</h4>
                  </div>

                  <div className="space-y-2 mb-4 max-h-[25vh] overflow-y-auto pr-2">
                    <AnimatePresence>
                      {profile.wishlist.length === 0 && (
                        <p className="text-sm text-white/40 text-center py-4 bg-black/20 rounded-xl border border-white/5">
                          登録されていません
                        </p>
                      )}
                      {profile.wishlist.map((wish) => (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          key={wish.id}
                          className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl group"
                        >
                          <span className="text-sm font-bold text-white/90 pl-1">
                            {wish.text}
                          </span>
                          <button
                            onClick={() => handleDeleteWish(wish.id)}
                            className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <form onSubmit={handleAddWish} className="relative group">
                    <input
                      type="text"
                      value={newWish}
                      onChange={(e) => setNewWish(e.target.value)}
                      placeholder="欲しいものを追加 (Enter)..."
                      className="w-full pl-4 pr-10 py-3 bg-black/40 border border-white/10 border-dashed rounded-xl text-sm font-medium focus:bg-black/60 focus:border-pink-400 focus:ring-1 focus:ring-pink-400 outline-none transition-all placeholder:text-white/30 text-white"
                    />
                    <button
                      type="submit"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/40 hover:text-pink-400 hover:bg-white/10 rounded-lg"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}