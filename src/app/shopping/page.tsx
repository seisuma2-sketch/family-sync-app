"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  CheckCircle2,
  Circle,
  Calendar as CalendarIcon,
  ArrowDownCircle,
  Trash2,
  Plus,
  Sparkles,
  Store,
  CheckCheck,
} from "lucide-react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  SHOPPING_CATEGORIES,
  QUICK_STOCK_ITEMS,
  detectCategory,
  getCategoryInfo,
} from "@/lib/shoppingCategories";

type ShoppingItemWithDate = {
  id: string;
  text: string;
  checked: boolean;
  category?: string;
  dateKey: string;
};

type DayData = {
  meals?: string[];
  shopping?: { id: string; text: string; checked: boolean; category?: string }[];
};

export default function ShoppingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [dayDataMap, setDayDataMap] = useState<Record<string, DayData>>({});
  const [newItemText, setNewItemText] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const router = useRouter();

  const getTodayKey = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2500);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const currentFamilyId =
          userSnap.exists() && userSnap.data().familyId
            ? userSnap.data().familyId
            : user.uid;
        setFamilyId(currentFamilyId);

        const calRef = collection(db, "users", currentFamilyId, "calendar");
        const unsubscribeDb = onSnapshot(calRef, (snapshot) => {
          const newMap: Record<string, DayData> = {};
          snapshot.forEach((docSnap) => {
            newMap[docSnap.id] = docSnap.data() as DayData;
          });
          setDayDataMap(newMap);
          setIsLoading(false);
        });
        return () => unsubscribeDb();
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  const allShoppingItems = useMemo(() => {
    const items: ShoppingItemWithDate[] = [];
    Object.entries(dayDataMap).forEach(([dateKey, data]) => {
      if (data.shopping && Array.isArray(data.shopping)) {
        data.shopping.forEach((item) => {
          items.push({
            ...item,
            category: item.category || detectCategory(item.text),
            dateKey,
          });
        });
      }
    });
    return items;
  }, [dayDataMap]);

  const pendingItems = useMemo(() => {
    const items = allShoppingItems.filter((item) => !item.checked);

    if (selectedFilter === "all" || selectedFilter === "store_order") {
      return [...items].sort((a, b) => {
        const orderA = getCategoryInfo(a.category).order;
        const orderB = getCategoryInfo(b.category).order;
        if (orderA !== orderB) return orderA - orderB;
        return a.dateKey.localeCompare(b.dateKey);
      });
    }

    if (selectedFilter === "by_date") {
      return [...items].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    }

    return items.filter((item) => item.category === selectedFilter);
  }, [allShoppingItems, selectedFilter]);

  const completedItems = useMemo(() => {
    return allShoppingItems.filter((item) => item.checked);
  }, [allShoppingItems]);

  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!familyId || !newItemText.trim()) return;

    const text = newItemText.trim();
    const todayKey = getTodayKey();
    const dayData = dayDataMap[todayKey] || {};
    const currentShopping = dayData.shopping || [];
    const autoCat = detectCategory(text);

    const newItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      text,
      checked: false,
      category: autoCat,
    };

    setNewItemText("");
    await setDoc(
      doc(db, "users", familyId, "calendar", todayKey),
      { shopping: [...currentShopping, newItem] },
      { merge: true }
    );
    showToast(`「${text}」を追加しました`);
  };

  const handleAddQuickStock = async (item: { text: string; emoji: string; category: string }) => {
    if (!familyId) return;
    const todayKey = getTodayKey();
    const dayData = dayDataMap[todayKey] || {};
    const currentShopping = dayData.shopping || [];

    const alreadyExists = currentShopping.some(
      (s) => s.text === item.text && !s.checked
    );
    if (alreadyExists) {
      showToast(`「${item.text}」はすでに追加されています`);
      return;
    }

    const newItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      text: item.text,
      checked: false,
      category: item.category,
    };

    await setDoc(
      doc(db, "users", familyId, "calendar", todayKey),
      { shopping: [...currentShopping, newItem] },
      { merge: true }
    );
    showToast(`${item.emoji}「${item.text}」を追加しました`);
  };

  const toggleCheck = async (dateKey: string, itemId: string) => {
    if (!familyId) return;
    const dayData = dayDataMap[dateKey];
    if (!dayData || !dayData.shopping) return;
    const updatedShopping = dayData.shopping.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    await setDoc(
      doc(db, "users", familyId, "calendar", dateKey),
      { shopping: updatedShopping },
      { merge: true }
    );
  };

  const handleDelete = async (dateKey: string, itemId: string) => {
    if (!familyId) return;
    const dayData = dayDataMap[dateKey];
    if (!dayData || !dayData.shopping) return;
    const updatedShopping = dayData.shopping.filter((item) => item.id !== itemId);
    await setDoc(
      doc(db, "users", familyId, "calendar", dateKey),
      { shopping: updatedShopping },
      { merge: true }
    );
  };

  const handleClearCompleted = async () => {
    if (!familyId) return;
    setShowClearConfirm(false);
    const promises = Object.entries(dayDataMap).map(async ([dateKey, data]) => {
      if (data.shopping && data.shopping.some((item) => item.checked)) {
        const remaining = data.shopping.filter((item) => !item.checked);
        return setDoc(
          doc(db, "users", familyId, "calendar", dateKey),
          { shopping: remaining },
          { merge: true }
        );
      }
    });
    await Promise.all(promises);
    showToast("カゴのアイテムをすべてクリアしました");
  };

  const formatDate = (dateStr: string) => {
    const [_, m, d] = dateStr.split("-");
    return `${parseInt(m)}/${parseInt(d)}`;
  };

  const previewCategory = useMemo(() => {
    if (!newItemText.trim()) return null;
    const catId = detectCategory(newItemText.trim());
    return getCategoryInfo(catId);
  }, [newItemText]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a1914] flex items-center justify-center text-emerald-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white flex">
      {/* 背景 */}
      <div className="fixed inset-0 -z-10 bg-black">
        <img
          src="/sizen.jpg"
          alt="Natural background"
          className="object-cover w-full h-full opacity-80"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 min-h-screen p-4 lg:p-10 pb-28 lg:pb-12 max-w-4xl mx-auto w-full">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pr-12 md:pr-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 lg:p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
              <ShoppingCart className="w-5 h-5 lg:w-6 lg:h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl lg:text-3xl font-extrabold text-white drop-shadow-md tracking-tight">
                まとめ買いリスト
              </h2>
              <p className="text-white/70 text-xs sm:text-sm font-medium mt-0.5">
                スーパーの売り場順に自動仕分け 🛒
              </p>
            </div>
          </div>

          {/* カウントバッジ */}
          <div className="flex items-center space-x-2 text-xs font-bold">
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
              買うもの: {pendingItems.length}
            </div>
            <div className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/60">
              カゴの中: {completedItems.length}
            </div>
          </div>
        </div>

        {/* ＝＝＝ 定番ストック ワンタップ追加 ＝＝＝ */}
        <div className="mb-5 bg-black/25 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 shadow-xl">
          <div className="flex items-center space-x-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="text-xs font-bold text-white/90">定番ストックをワンタップ追加</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {QUICK_STOCK_ITEMS.map((item) => (
              <button
                key={item.text}
                type="button"
                onClick={() => handleAddQuickStock(item)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold text-white shrink-0 active:scale-95 transition-all shadow-sm hover:border-emerald-400/50"
              >
                <span>{item.emoji}</span>
                <span>{item.text}</span>
                <Plus className="w-3 h-3 text-emerald-400 ml-0.5" />
              </button>
            ))}
          </div>
        </div>

        {/* ＝＝＝ 新規アイテム入力フォーム ＝＝＝ */}
        <form onSubmit={handleAddItem} className="mb-5 relative">
          <div className="relative flex items-center">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="買うものを入力（例: 人参、牛乳、豚肉、洗剤）..."
              className="w-full pl-4 pr-20 py-3 bg-black/35 backdrop-blur-xl border border-white/15 rounded-2xl text-sm font-medium focus:bg-black/50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all placeholder:text-white/40 text-white shadow-lg"
            />
            <button
              type="submit"
              disabled={!newItemText.trim()}
              className={clsx(
                "absolute right-2 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all shadow-md",
                newItemText.trim()
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white active:scale-95"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              )}
            >
              <Plus className="w-4 h-4" />
              <span>追加</span>
            </button>
          </div>

          {previewCategory && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 flex items-center space-x-2 text-xs text-white/70 pl-2"
            >
              <span>自動仕分け:</span>
              <span
                className={clsx(
                  "inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold shadow-sm",
                  previewCategory.bgColor,
                  previewCategory.borderColor,
                  previewCategory.color
                )}
              >
                <span>{previewCategory.emoji}</span>
                <span>{previewCategory.name}</span>
              </span>
            </motion.div>
          )}
        </form>

        {/* ＝＝＝ 売り場順・フィルター切り替え ＝＝＝ */}
        <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setSelectedFilter("all")}
            className={clsx(
              "px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center space-x-1.5 shadow-sm",
              selectedFilter === "all"
                ? "bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20 shadow-md"
                : "bg-white/10 text-white/70 border-white/10 hover:bg-white/15 hover:text-white"
            )}
          >
            <Store className="w-3.5 h-3.5" />
            <span>🏪 売り場順</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter("by_date")}
            className={clsx(
              "px-3 py-1.5 rounded-xl border transition-all shrink-0 flex items-center space-x-1.5 shadow-sm",
              selectedFilter === "by_date"
                ? "bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20 shadow-md"
                : "bg-white/10 text-white/70 border-white/10 hover:bg-white/15 hover:text-white"
            )}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>日付順</span>
          </button>

          <div className="w-[1px] h-4 bg-white/20 mx-1 shrink-0" />

          {SHOPPING_CATEGORIES.map((cat) => {
            const isSelected = selectedFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedFilter(cat.id)}
                className={clsx(
                  "px-2.5 py-1.5 rounded-xl border transition-all shrink-0 flex items-center space-x-1 shadow-sm",
                  isSelected
                    ? "bg-white/25 text-white border-white/40 ring-1 ring-white/50"
                    : "bg-white/5 text-white/60 border-white/10 hover:bg-white/15 hover:text-white"
                )}
              >
                <span>{cat.emoji}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* ＝＝＝ 買うものリスト ＝＝＝ */}
        <div className="flex-1 overflow-y-auto space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-base font-bold text-emerald-400 drop-shadow-sm flex items-center space-x-2">
                <span>買うもの</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {pendingItems.length}
                </span>
              </h3>
              {selectedFilter === "all" && (
                <span className="text-[11px] text-white/40 font-medium">
                  スーパーを回る順で並んでいます
                </span>
              )}
            </div>

            {pendingItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/50 bg-black/25 backdrop-blur-md rounded-2xl border border-white/10">
                <CheckCheck className="w-12 h-12 mb-3 text-emerald-400 opacity-60" />
                <p className="font-bold text-base text-white/90">買うものはすべて揃っています！</p>
                <p className="text-xs text-white/50 mt-1">
                  上の定番ストックや入力欄から、思いついたものをサッと追加できます。
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <AnimatePresence mode="popLayout">
                  {pendingItems.map((item) => {
                    const catInfo = getCategoryInfo(item.category);
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, x: -20 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => toggleCheck(item.dateKey, item.id)}
                        className="flex items-center justify-between p-3.5 bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl shadow-lg hover:bg-white/15 hover:border-emerald-400/50 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center space-x-3 overflow-hidden flex-1">
                          <Circle className="w-5 h-5 text-white/30 shrink-0 group-hover:text-emerald-400 transition-colors" />
                          <span className="text-base font-bold text-white truncate drop-shadow-sm">
                            {item.text}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0 ml-3">
                          <span
                            className={clsx(
                              "inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border shadow-sm",
                              catInfo.bgColor,
                              catInfo.borderColor,
                              catInfo.color
                            )}
                          >
                            <span>{catInfo.emoji}</span>
                            <span className="hidden sm:inline">{catInfo.name}</span>
                          </span>

                          <div className="flex items-center space-x-1 px-2.5 py-1 bg-white/10 rounded-xl text-[11px] font-bold text-white/60">
                            <CalendarIcon className="w-3 h-3 text-white/40" />
                            <span>{formatDate(item.dateKey)}</span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.dateKey, item.id);
                            }}
                            className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all sm:opacity-0 group-hover:opacity-100"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* ＝＝＝ カゴに入れたもの ＝＝＝ */}
          {completedItems.length > 0 && (
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-3 px-1 text-white/60">
                <div className="flex items-center space-x-2">
                  <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white/80">
                    カゴに入れたもの ({completedItems.length})
                  </h3>
                </div>

                {!showClearConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="text-xs text-white/40 hover:text-red-400 hover:underline transition-all flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>カゴの中を空にする</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-red-300">すべて削除しますか？</span>
                    <button
                      type="button"
                      onClick={handleClearCompleted}
                      className="px-2.5 py-1 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-sm"
                    >
                      削除
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg text-xs"
                    >
                      キャンセル
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 opacity-65">
                <AnimatePresence mode="popLayout">
                  {completedItems.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={() => toggleCheck(item.dateKey, item.id)}
                      className="flex items-center justify-between p-3 bg-black/35 backdrop-blur-md border border-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors group"
                    >
                      <div className="flex items-center space-x-3 overflow-hidden flex-1">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        <span className="text-sm font-medium text-white/60 line-through truncate">
                          {item.text}
                        </span>
                        <span className="text-[10px] font-bold text-white/30 shrink-0 ml-1">
                          {formatDate(item.dateKey)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.dateKey, item.id);
                        }}
                        className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all shrink-0 ml-2 sm:opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* トースト通知 */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-2 px-5 py-3 bg-emerald-500 text-white rounded-full shadow-[0_10px_40px_rgba(16,185,129,0.4)] font-bold text-sm pointer-events-none"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{toastMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}