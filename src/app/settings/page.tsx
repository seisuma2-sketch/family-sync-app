"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Copy, CheckCircle2, Heart, Home, Coffee, Plus, ChevronRight, X, Gift } from "lucide-react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import clsx from "clsx";

type WishItem = { id: string; text: string };
type Member = { uid: string; familyId: string; groupType?: string; displayName?: string; emoji?: string; photoUrl?: string | null; wishlist?: WishItem[]; isMe: boolean; };

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [groupType, setGroupType] = useState<string>("family");
  
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [showInviteSection, setShowInviteSection] = useState(false);
  
  const [selectedPartner, setSelectedPartner] = useState<Member | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        let currentFamilyId = user.uid;
        let currentGroupType = "family";

        if (userSnap.exists()) {
          if (userSnap.data().familyId) currentFamilyId = userSnap.data().familyId;
          if (userSnap.data().groupType) currentGroupType = userSnap.data().groupType;
        } else {
          await setDoc(userRef, { familyId: user.uid, groupType: "family" }, { merge: true });
        }
        
        setFamilyId(currentFamilyId);
        setGroupType(currentGroupType);

        const q = query(collection(db, "users"), where("familyId", "==", currentFamilyId));
        const unsubscribeMembers = onSnapshot(q, (snapshot) => {
          const memberList: Member[] = [];
          snapshot.forEach(d => { memberList.push({ uid: d.id, ...d.data() } as Member & { isMe: boolean }); });
          const sorted = memberList.map(m => ({ ...m, isMe: m.uid === user.uid })).sort((a, b) => (a.isMe ? -1 : 1));
          setMembers(sorted);
          
          if (selectedPartner) {
            setSelectedPartner(sorted.find(m => m.uid === selectedPartner.uid) || null);
          }
          setIsLoading(false);
        });
        return () => unsubscribeMembers();
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribeAuth();
  }, [router, selectedPartner]);

  const partners = members.filter(m => !m.isMe);

  const handleGroupTypeChange = async (type: string) => {
    if (!userId) return;
    setGroupType(type);
    await setDoc(doc(db, "users", userId), { groupType: type }, { merge: true });
  };

  const handleCopyCode = () => {
    if (!userId) return;
    navigator.clipboard.writeText(userId);
    setToastMsg("招待コードをコピーしました！");
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleLinkPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !inviteCodeInput.trim()) return;
    try {
      await setDoc(doc(db, "users", userId), { familyId: inviteCodeInput.trim() }, { merge: true });
      setInviteCodeInput("");
      setToastMsg("メンバーと同期しました！");
      setTimeout(() => setToastMsg(""), 4000);
    } catch (error) {
      console.error("リンク失敗:", error);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-emerald-400">Loading...</div>;

  const groupTypes = [
    { id: "couple", label: "カップル", icon: Heart },
    { id: "family", label: "家族", icon: Home },
    { id: "roommate", label: "ルームシェア", icon: Coffee },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden text-white flex">
      <div className="fixed inset-0 -z-10 bg-black">
        <img src="/sizen.jpg" alt="Natural background" className="object-cover w-full h-full opacity-80" />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 min-h-screen p-4 lg:p-10 pb-24 lg:pb-8 ml-0 md:ml-64">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
              <Users className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white drop-shadow-md tracking-tight">メンバー管理</h2>
              <p className="text-white/60 text-sm font-medium mt-1">ダッシュボード</p>
            </div>
          </div>
          
          <div className="flex p-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl">
            {groupTypes.map(type => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id} onClick={() => handleGroupTypeChange(type.id)}
                  className={clsx("flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all", groupType === type.id ? "bg-white/20 text-white shadow-sm" : "text-white/40 hover:text-white/80 hover:bg-white/5")}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-w-5xl w-full mx-auto space-y-8 mt-2">
          
          <section>
            <h3 className="text-lg font-bold text-white/80 mb-4 flex items-center">
              <div className="w-2 h-2 rounded-full bg-cyan-400 mr-2 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
              Sync メンバー
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              <AnimatePresence>
                {/* 相手のカード一覧 */}
                {partners.map((partner, index) => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.1 }}
                    key={partner.uid} onClick={() => setSelectedPartner(partner)}
                    className="p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl flex flex-col relative overflow-hidden group cursor-pointer hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center space-x-4 mb-4">
                      {partner.photoUrl ? (
                        <img src={partner.photoUrl} alt="Partner" className="w-14 h-14 rounded-full object-cover border border-white/20 shadow-inner group-hover:scale-110 transition-transform" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
                          {partner.emoji || "👤"}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-lg text-white">{partner.displayName || "パートナー"}</h4>
                        <p className="text-xs text-white/50 font-mono mt-0.5 truncate w-24">ID: {partner.uid.substring(0, 6)}...</p>
                      </div>
                    </div>
                    <div className="mt-auto">
                      {partner.wishlist && partner.wishlist.length > 0 ? (
                        <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-xs text-white/70 flex items-center">
                          <Gift className="w-4 h-4 mr-2 text-pink-400 shrink-0" />
                          <span className="truncate">欲しいもの: {partner.wishlist[0].text} {partner.wishlist.length > 1 && `他`}</span>
                        </div>
                      ) : (
                        <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-xs text-white/40 flex items-center">
                          <Gift className="w-4 h-4 mr-2 opacity-50 shrink-0" />
                          <span>欲しいものはまだありません</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* パートナーがいない場合の招待カード */}
                {partners.length === 0 && (
                  <motion.button
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setShowInviteSection(!showInviteSection)}
                    className={clsx(
                      "p-6 bg-white/5 backdrop-blur-md border-2 border-dashed rounded-3xl shadow-lg flex flex-col items-center justify-center text-white/50 hover:bg-white/10 hover:border-cyan-400/50 hover:text-cyan-400 transition-all min-h-[140px]",
                      showInviteSection ? "border-cyan-400/50 text-cyan-400 bg-white/10" : "border-white/20"
                    )}
                  >
                    <Plus className="w-8 h-8 mb-2 opacity-80" />
                    <span className="font-bold text-sm">メンバーを招待・参加する</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* 招待パネル展開 */}
            <AnimatePresence>
              {showInviteSection && partners.length === 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 pt-4">
                    <div className="p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-lg">
                      <h3 className="text-sm font-bold text-emerald-400 mb-1 flex items-center"><ChevronRight className="w-4 h-4 mr-1"/> 招待する</h3>
                      <p className="text-xs text-white/60 mb-4 ml-5">相手にこのIDを入力してもらいます。</p>
                      <div className="flex items-center space-x-2 ml-5">
                        <div className="flex-1 p-3.5 bg-black/40 border border-white/10 rounded-xl font-mono text-sm overflow-x-auto text-white/80 shadow-inner">{userId}</div>
                        <button onClick={handleCopyCode} className="shrink-0 p-3.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-500 hover:text-white transition-all active:scale-95"><Copy className="w-5 h-5" /></button>
                      </div>
                    </div>
                    <div className="p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-lg">
                      <h3 className="text-sm font-bold text-cyan-400 mb-1 flex items-center"><ChevronRight className="w-4 h-4 mr-1"/> 参加する</h3>
                      <p className="text-xs text-white/60 mb-4 ml-5">もらったIDを入力（※あなたの予定は上書きされます）</p>
                      <form onSubmit={handleLinkPartner} className="flex gap-2 ml-5">
                        <input type="text" value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value)} placeholder="招待IDを入力..." className="flex-1 p-3.5 bg-black/40 border border-white/10 rounded-xl font-mono text-sm focus:bg-black/60 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition-all placeholder:text-white/30 text-white shadow-inner" />
                        <button type="submit" disabled={!inviteCodeInput.trim()} className="px-5 bg-cyan-500/80 text-black font-bold rounded-xl hover:bg-cyan-400 disabled:opacity-50 transition-all active:scale-95">同期</button>
                      </form>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

        </div>
      </div>

      {/* ＝＝＝ パートナーの詳細（欲しいもの覗き見）モーダル ＝＝＝ */}
      <AnimatePresence>
        {selectedPartner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPartner(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0a1510]/90 backdrop-blur-2xl border border-white/20 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                <h3 className="font-extrabold text-lg text-white">パートナー情報</h3>
                <button onClick={() => setSelectedPartner(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X className="w-5 h-5 text-white" /></button>
              </div>

              <div className="p-8 flex flex-col items-center">
                {selectedPartner.photoUrl ? (
                  <img src={selectedPartner.photoUrl} alt="Partner" className="w-24 h-24 rounded-full object-cover border border-white/20 shadow-inner mb-4" />
                ) : (
                  <div className="w-24 h-24 text-5xl bg-black/40 border border-white/10 rounded-full flex items-center justify-center shadow-inner mb-4">
                    {selectedPartner.emoji || "👤"}
                  </div>
                )}
                <h4 className="text-2xl font-extrabold text-white mb-8">{selectedPartner.displayName || "パートナー"}</h4>

                <div className="w-full">
                  <div className="flex items-center space-x-2 mb-4 text-pink-400">
                    <Gift className="w-5 h-5" />
                    <h4 className="font-bold">欲しいものリスト</h4>
                  </div>
                  
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                    {(!selectedPartner.wishlist || selectedPartner.wishlist.length === 0) ? (
                      <p className="text-sm text-white/40 text-center py-6 bg-black/20 rounded-xl border border-white/5">まだ何も登録されていません</p>
                    ) : (
                      selectedPartner.wishlist.map((wish) => (
                        <div key={wish.id} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                          <span className="text-sm font-bold text-white/90 pl-1">{wish.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-24 md:bottom-12 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-2 px-6 py-3 bg-emerald-500 text-black rounded-full shadow-[0_10px_40px_rgba(16,185,129,0.3)] font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}