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
  Minus,
  Sparkles,
  Store,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  PartyPopper,
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
  ShoppingCategory,
} from "@/lib/shoppingCategories";

type ShoppingItemWithDate = {
  id: string;
  text: string;
  checked: boolean;
  category?: string;
  quantity?: number;
  dateKey: string;
};

type DayData = {
  meals?: string[];
  shopping?: {
    id: string;
    text: string;
    checked: boolean;
    category?: string;
    quantity?: number;
  }[];
};

export default function ShoppingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [dayDataMap, setDayDataMap] = useState<Record<string, DayData>>({});
  const [newItemText, setNewItemText] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // 折りたたまれたカテゴリーの記録
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
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

  // すべての買い物アイテムを集約・カテゴリーと数量の正規化
  const allShoppingItems = useMemo(() => {
    const items: ShoppingItemWithDate[] = [];
    Object.entries(dayDataMap).forEach(([dateKey, data]) => {
      if (data.shopping && Array.isArray(data.shopping)) {
        data.shopping.forEach((item) => {
          items.push({
            ...item,
            category: item.category || detectCategory(item.text),
            quantity: item.quantity || 1,
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

  // ＝＝＝ 進捗率の計算 ＝＝＝
  const totalCount = pendingItems.length + completedItems.length;
  const progressPercent = totalCount > 0 ? Math.round((completedItems.length / totalCount) * 100) : 0;
  const isAllCompleted = totalCount > 0 && pendingItems.length === 0;

  // ＝＝＝ 売り場ごとのグループ分け ＝＝＝
  const groupedSections = useMemo(() => {
    if (selectedFilter === "by_date") {
      // 日付順グループ
      const dateMap: Record<string, ShoppingItemWithDate[]> = {};
      pendingItems.forEach((item) => {
        if (!dateMap[item.dateKey]) dateMap[item.dateKey] = [];
        dateMap[item.dateKey].push(item);
      });
      return Object.entries(dateMap).map(([dateKey, items]) => {
        const [_, m, d] = dateKey.split("-");
        return {
          id: dateKey,
          title: `${parseInt(m)}月${parseInt(d)}日`,
          emoji: "📅",
          badgeColor: "bg-white/10 text-white/80 border-white/20",
          items,
        };
      });
    }

    // 売り場順（カテゴリー別グループ）
    const sections: {
      id: string;
      title: string;
      emoji: string;
      badgeColor: string;
      items: ShoppingItemWithDate[];
    }[] = [];

    const categoriesToShow =
      selectedFilter === "all" || selectedFilter === "store_order"
        ? SHOPPING_CATEGORIES
        : SHOPPING_CATEGORIES.filter((c) => c.id === selectedFilter);

    categoriesToShow.forEach((cat) => {
      const itemsInCat = pendingItems.filter((item) => item.category === cat.id);
      if (itemsInCat.length > 0) {
        sections.push({
          id: cat.id,
          title: cat.name,
          emoji: cat.emoji,
          badgeColor: `${cat.bgColor} ${cat.color} ${cat.borderColor}`,
          items: itemsInCat,
        });
      }
    });

    return sections;
  }, [pendingItems, selectedFilter]);

  const toggleCategoryCollapse = (catId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  // アイテム直接追加（スペースや改行での複数一括入力にも対応）
  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!familyId || !newItemText.trim()) return;

    // スペース、読点、改行で分割
    const rawTokens = newItemText.split(/[\s,、\n]+/);
    const tokens = rawTokens.map((t) => t.trim()).filter((t) => t.length > 0);

    if (tokens.length === 0) return;

    const todayKey = getTodayKey();
    const dayData = dayDataMap[todayKey] || {};
    const currentShopping = dayData.shopping || [];

    const newItems = tokens.map((text) => ({
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      text,
      checked: false,
      category: detectCategory(text),
      quantity: 1,
    }));

    setNewItemText("");
    await setDoc(
      doc(db, "users", familyId, "calendar", todayKey),
      { shopping: [...currentShopping, ...newItems] },
      { merge: true }
    );

    if (newItems.length === 1) {
      showToast(`「${newItems[0].text}」を追加しました`);
    } else {
      showToast(`${newItems.length}個の品目をまとめて追加しました`);
    }
  };

  // 定番ストックからのワンタップ追加
  const handleAddQuickStock = async (item: { text: string; emoji: string; category: string }) => {
    if (!familyId) return;
    const todayKey = getTodayKey();
    const dayData = dayDataMap[todayKey] || {};
    const currentShopping = dayData.shopping || [];

    const existingItem = currentShopping.find(
      (s) => s.text === item.text && !s.checked
    );
    if (existingItem) {
      // 既にある場合は数量を+1
      await updateQuantity(todayKey, existingItem.id, 1);
      showToast(`「${item.text}」の数量を増やしました (+1)`);
      return;
    }

    const newItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      text: item.text,
      checked: false,
      category: item.category,
      quantity: 1,
    };

    await setDoc(
      doc(db, "users", familyId, "calendar", todayKey),
      { shopping: [...currentShopping, newItem] },
      { merge: true }
    );
    showToast(`${item.emoji}「${item.text}」を追加しました`);
  };

  // 数量の変更 (+ / -)
  const updateQuantity = async (dateKey: string, itemId: string, delta: number) => {
    if (!familyId) return;
    const dayData = dayDataMap[dateKey];
    if (!dayData || !dayData.shopping) return;

    const updatedShopping = dayData.shopping.map((item) => {
      if (item.id === itemId) {
        const cur = item.quantity || 1;
        const newQty = Math.max(1, cur + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    });

    await setDoc(
      doc(db, "users", familyId, "calendar", dateKey),
      { shopping: updatedShopping },
      { merge: true }
    );
  };

  // チェック切り替え（カゴへ移動）
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

  // アイテム削除
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

  // カゴに入れたものを一括削除
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
    const firstToken = newItemText.split(/[\s,、\n]+/)[0];
    const catId = detectCategory(firstToken);
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pr-12 md:pr-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 lg:p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
              <ShoppingCart className="w-5 h-5 lg:w-6 lg:h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl lg:text-3xl font-extrabold text-white drop-shadow-md tracking-tight">
                まとめ買いリスト
              </h2>
              <p className="text-white/70 text-xs sm:text-sm font-medium mt-0.5">
                売り場順セクション × 数量調整 × 進捗ゲージ 🛒
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

        {/* ＝＝＝ 1. 買い物進捗ゲージ ＝＝＝ */}
        {totalCount > 0 && (
          <div className="mb-5 p-3.5 bg-black/35 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="font-bold text-white/80 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span>買い出し進捗</span>
              </span>
              <span className="font-extrabold text-emerald-300">
                {isAllCompleted ? "✨ すべて完了！" : `あと ${pendingItems.length}品 (${progressPercent}%)`}
              </span>
            </div>
            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={clsx(
                  "h-full rounded-full transition-all shadow-sm",
                  isAllCompleted
                    ? "bg-gradient-to-r from-emerald-400 to-cyan-400"
                    : "bg-gradient-to-r from-emerald-500 to-teal-400"
                )}
              />
            </div>
          </div>
        )}

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

        {/* ＝＝＝ 新規アイテム入力フォーム（まとめ入力対応） ＝＝＝ */}
        <form onSubmit={handleAddItem} className="mb-5 relative">
          <div className="relative flex items-center">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="買うものを入力（スペース区切りで一括追加も可能）..."
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
        <div className="mb-5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
            <span>🏪 売り場順（すべて）</span>
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

        {/* ＝＝＝ 買うものリスト（セクション別グループ表示） ＝＝＝ */}
        <div className="flex-1 overflow-y-auto space-y-6">
          <div>
            {/* 全品達成バナー */}
            {isAllCompleted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 mb-6 bg-gradient-to-b from-emerald-500/25 to-teal-500/10 backdrop-blur-xl border border-emerald-400/30 rounded-3xl text-center shadow-2xl"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/30 border border-emerald-400/40 rounded-full mb-3 shadow-lg">
                  <PartyPopper className="w-7 h-7 text-emerald-300 animate-bounce" />
                </div>
                <h3 className="text-xl font-extrabold text-white mb-1">
                  買い出しコンプリート！🎉
                </h3>
                <p className="text-emerald-100/80 text-xs sm:text-sm font-medium mb-4">
                  リストのすべての商品がカゴに入りました。お疲れ様でした！
                </p>
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold shadow-lg transition-all active:scale-95"
                >
                  カゴを空にして完了する
                </button>
              </motion.div>
            ) : pendingItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/50 bg-black/25 backdrop-blur-md rounded-2xl border border-white/10">
                <CheckCheck className="w-12 h-12 mb-3 text-emerald-400 opacity-60" />
                <p className="font-bold text-base text-white/90">買うものはすべて揃っています！</p>
                <p className="text-xs text-white/50 mt-1">
                  上の定番ストックや入力欄から、思いついたものをサッと追加できます。
                </p>
              </div>
            ) : (
              /* ＝＝＝ 売り場セクション一覧 ＝＝＝ */
              <div className="space-y-5">
                {groupedSections.map((section) => {
                  const isCollapsed = collapsedCategories[section.id];
                  return (
                    <div
                      key={section.id}
                      className="bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 shadow-lg"
                    >
                      {/* セクション見出し */}
                      <button
                        type="button"
                        onClick={() => toggleCategoryCollapse(section.id)}
                        className="w-full flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-left group"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-base">{section.emoji}</span>
                          <span className="text-sm font-extrabold text-white tracking-tight">
                            {section.title}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10">
                            {section.items.length}品
                          </span>
                        </div>
                        <div className="text-white/40 group-hover:text-white/80 transition-colors">
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </div>
                      </button>

                      {/* セクション内アイテム */}
                      {!isCollapsed && (
                        <div className="space-y-2">
                          <AnimatePresence mode="popLayout">
                            {section.items.map((item) => (
                              <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9, x: -20 }}
                                transition={{ duration: 0.15 }}
                                onClick={() => toggleCheck(item.dateKey, item.id)}
                                className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl shadow-sm cursor-pointer transition-all group"
                              >
                                {/* 左側：チェックボックスと品名 */}
                                <div className="flex items-center space-x-3 overflow-hidden flex-1">
                                  <Circle className="w-5 h-5 text-white/30 shrink-0 group-hover:text-emerald-400 transition-colors" />
                                  <div className="flex items-center space-x-2 truncate">
                                    <span className="text-sm sm:text-base font-bold text-white truncate drop-shadow-sm">
                                      {item.text}
                                    </span>
                                    {/* 数量が2以上のときのハイライトバッジ */}
                                    {(item.quantity || 1) > 1 && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 text-xs font-black shrink-0">
                                        ×{item.quantity}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 右側：数量カウンター (+/-) と日付と削除ボタン */}
                                <div className="flex items-center space-x-2 shrink-0 ml-2">
                                  {/* 数量カウンター (+ / -) */}
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center bg-black/40 border border-white/15 rounded-lg px-1 py-0.5"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.dateKey, item.id, -1)}
                                      className="w-5 h-5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded transition-all active:scale-90"
                                      title="減らす"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="px-1 text-xs font-bold text-white min-w-[16px] text-center">
                                      {item.quantity || 1}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => updateQuantity(item.dateKey, item.id, 1)}
                                      className="w-5 h-5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded transition-all active:scale-90"
                                      title="増やす"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* 日付バッジ */}
                                  <div className="flex items-center space-x-1 px-2 py-1 bg-white/10 rounded-lg text-[10px] font-bold text-white/60">
                                    <CalendarIcon className="w-2.5 h-2.5 text-white/40" />
                                    <span>{formatDate(item.dateKey)}</span>
                                  </div>

                                  {/* 削除ボタン */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(item.dateKey, item.id);
                                    }}
                                    className="p-1 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all sm:opacity-0 group-hover:opacity-100"
                                    title="削除"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  );
                })}
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
                          {(item.quantity || 1) > 1 && ` (×${item.quantity})`}
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