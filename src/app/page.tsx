"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Utensils,
  ShoppingCart,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Calendar as CalendarIcon,
  Sparkles,
  CalendarDays,
  Lightbulb,
  Clock,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
} from "lucide-react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  arrayRemove,
  arrayUnion,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { detectCategory, getCategoryInfo } from "@/lib/shoppingCategories";
import { triggerHaptic } from "@/lib/haptics";
import { getJapaneseHoliday, getDayTrivia } from "@/lib/calendarTrivia";

// ＝＝＝ さらさら感のあるローディング画面 ＝＝＝
const LoadingScreen = () => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07160e]/95 backdrop-blur-md">
    <div className="relative w-72 h-36 flex flex-col items-center justify-center">
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(16,185,129,0.3)] backdrop-blur-xl"
      >
        <Sparkles className="w-8 h-8 text-emerald-300" />
      </motion.div>
      <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
          className="w-1/2 h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full"
        />
      </div>
      <span className="text-xs font-bold tracking-widest text-emerald-300/80">
        読み込み中...
      </span>
    </div>
  </div>
);

type ShoppingItem = {
  id: string;
  text: string;
  checked: boolean;
  category?: string;
  quantity?: number;
};

type CalendarEvent = {
  id: string;
  text: string;
  time?: string;
};

type DayData = {
  meals: string[];
  shopping: ShoppingItem[];
  events: CalendarEvent[];
};

type CellDate = {
  year: number;
  month: number;
  day: number;
  isCurrentMonth: boolean;
  dateKey: string;
};

// ＝＝＝ 詳細パネル / ボトムシート ＝＝＝
const DetailContent = ({
  year,
  month,
  day,
  dateKey,
  familyId,
  onClose,
  onPrevDay,
  onNextDay,
  isMobile = false,
}: {
  year: number;
  month: number;
  day: number;
  dateKey: string;
  familyId: string;
  onClose: () => void;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  isMobile?: boolean;
}) => {
  const [data, setData] = useState<DayData>({ meals: [], shopping: [], events: [] });
  const [newMeal, setNewMeal] = useState("");
  const [newShopping, setNewShopping] = useState("");
  const [newEvent, setNewEvent] = useState("");

  const holiday = getJapaneseHoliday(year, month, day);
  const trivia = getDayTrivia(month, day);
  const displayDateStr = `${month}月${day}日`;

  useEffect(() => {
    if (!familyId || !dateKey) return;
    const unsubscribe = onSnapshot(
      doc(db, "users", familyId, "calendar", dateKey),
      (docSnap) => {
        if (docSnap.exists()) {
          const raw = docSnap.data();
          // 文字列またはオブジェクトの予定を正規化
          const rawEvents = Array.isArray(raw?.events) ? raw.events : [];
          const safeEvents: CalendarEvent[] = rawEvents.map((item: any, idx: number) => {
            if (typeof item === "string") return { id: `ev-${idx}-${item}`, text: item };
            return { id: item.id || `ev-${idx}`, text: item.text || item.title || "", time: item.time };
          });

          setData({
            meals: Array.isArray(raw?.meals) ? raw.meals : [],
            shopping: Array.isArray(raw?.shopping) ? raw.shopping : [],
            events: safeEvents,
          });
        } else {
          setData({ meals: [], shopping: [], events: [] });
        }
      }
    );
    return () => unsubscribe();
  }, [familyId, dateKey]);

  const saveToFirestore = async (newData: DayData) => {
    if (familyId && dateKey) {
      await setDoc(doc(db, "users", familyId, "calendar", dateKey), newData, {
        merge: true,
      });
    }
  };

  // ＝＝＝ 予定の追加・削除 ＝＝＝
  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.trim()) return;
    triggerHaptic("medium");
    const currentEvents = Array.isArray(data.events) ? data.events : [];
    const eventItem: CalendarEvent = {
      id: Date.now().toString(),
      text: newEvent.trim(),
    };
    saveToFirestore({ ...data, events: [...currentEvents, eventItem] });
    setNewEvent("");
  };

  const handleDeleteEvent = (idToRemove: string) => {
    triggerHaptic("medium");
    const currentEvents = Array.isArray(data.events) ? data.events : [];
    saveToFirestore({ ...data, events: currentEvents.filter((item) => item.id !== idToRemove) });
  };

  // ＝＝＝ 献立の追加・削除 ＝＝＝
  const handleAddMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeal.trim()) return;
    triggerHaptic("medium");
    const currentMeals = Array.isArray(data.meals) ? data.meals : [];
    saveToFirestore({ ...data, meals: [...currentMeals, newMeal.trim()] });
    setNewMeal("");
  };

  const handleDeleteMeal = (indexToRemove: number) => {
    triggerHaptic("medium");
    const currentMeals = Array.isArray(data.meals) ? data.meals : [];
    saveToFirestore({ ...data, meals: currentMeals.filter((_, idx) => idx !== indexToRemove) });
  };

  // ＝＝＝ 買い物の追加・チェック・削除 ＝＝＝
  const handleAddShopping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopping.trim()) return;
    triggerHaptic("medium");
    const currentShopping = Array.isArray(data.shopping) ? data.shopping : [];
    saveToFirestore({
      ...data,
      shopping: [
        ...currentShopping,
        {
          id: Date.now().toString(),
          text: newShopping.trim(),
          checked: false,
          category: detectCategory(newShopping.trim()),
          quantity: 1,
        },
      ],
    });
    setNewShopping("");
  };

  const toggleShoppingCheck = (id: string) => {
    triggerHaptic("light");
    const currentShopping = Array.isArray(data.shopping) ? data.shopping : [];
    saveToFirestore({
      ...data,
      shopping: currentShopping.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      ),
    });
  };

  const handleDeleteShopping = (idToRemove: string) => {
    triggerHaptic("medium");
    const currentShopping = Array.isArray(data.shopping) ? data.shopping : [];
    saveToFirestore({ ...data, shopping: currentShopping.filter((item) => item.id !== idToRemove) });
  };

  const safeEvents = Array.isArray(data?.events) ? data.events : [];
  const safeMeals = Array.isArray(data?.meals) ? data.meals : [];
  const safeShopping = Array.isArray(data?.shopping) ? data.shopping : [];

  return (
    <div className="h-full flex flex-col text-white">
      {/* ＝＝＝ ヘッダーエリア ＝＝＝ */}
      {isMobile ? (
        <div className="relative pt-3 pb-3 px-5 border-b border-white/10 shrink-0">
          <div className="w-12 h-1.5 bg-white/25 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              {onPrevDay && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    onPrevDay();
                  }}
                  className="p-1.5 bg-white/10 hover:bg-white/20 active:scale-95 rounded-xl border border-white/10 transition-all text-white/80"
                  aria-label="前日"
                >
                  <PrevIcon className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center space-x-2 px-2">
                <h3 className="font-extrabold text-lg text-white drop-shadow">
                  {displayDateStr}
                </h3>
                {holiday && (
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-300 border border-rose-400/40">
                    {holiday}
                  </span>
                )}
              </div>
              {onNextDay && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    onNextDay();
                  }}
                  className="p-1.5 bg-white/10 hover:bg-white/20 active:scale-95 rounded-xl border border-white/10 transition-all text-white/80"
                  aria-label="翌日"
                >
                  <NextIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => {
                triggerHaptic("light");
                onClose();
              }}
              className="p-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full transition-colors border border-white/10"
              aria-label="閉じる"
            >
              <X className="w-4 h-4 text-white/80" />
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-5 shrink-0 flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center space-x-2">
            {onPrevDay && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onPrevDay();
                }}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 transition-all"
              >
                <PrevIcon className="w-4 h-4 text-white" />
              </button>
            )}
            <div className="flex items-center space-x-2 px-1">
              <h3 className="text-2xl font-extrabold drop-shadow-md text-white">
                {displayDateStr}
              </h3>
              {holiday && (
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-500/25 text-rose-300 border border-rose-400/40">
                  {holiday}
                </span>
              )}
            </div>
            {onNextDay && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onNextDay();
                }}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 transition-all"
              >
                <NextIcon className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors border border-white/10"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* ＝＝＝ スクロールコンテンツ ＝＝＝ */}
      <div
        className={clsx(
          "flex-1 overflow-y-auto space-y-6 pb-28",
          isMobile ? "p-4" : "pr-1"
        )}
      >
        {/* 🌟 1. 今日の雑学・記念日カード（ご要望の新機能！） */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 backdrop-blur-md shadow-md text-amber-100 flex items-start space-x-3"
        >
          <div className="text-2xl shrink-0 p-1.5 bg-amber-400/15 rounded-xl border border-amber-400/20">
            {trivia.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h5 className="font-extrabold text-xs text-amber-300 tracking-wide flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                <span>{trivia.title}</span>
              </h5>
              {trivia.tag && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-200">
                  {trivia.tag}
                </span>
              )}
            </div>
            <p className="text-xs text-amber-100/90 leading-relaxed font-medium">
              {trivia.trivia}
            </p>
          </div>
        </motion.div>

        {/* 🌟 2. 予定セクション（ご要望の新機能！） */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center space-x-2 text-purple-300">
              <div className="p-1.5 rounded-lg bg-purple-500/20 border border-purple-400/30">
                <CalendarDays className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm tracking-wide">
                予定・スケジュール ({safeEvents.length})
              </h4>
            </div>
          </div>

          <div className="space-y-2">
            <AnimatePresence>
              {safeEvents.length === 0 ? (
                <p className="text-xs text-white/40 py-3 text-center bg-white/[0.04] rounded-xl border border-white/5 font-medium">
                  予定はありません
                </p>
              ) : (
                safeEvents.map((ev) => (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={ev.id}
                    className="flex items-center justify-between p-3 bg-purple-500/15 backdrop-blur-md border border-purple-400/25 rounded-xl shadow-md group hover:bg-purple-500/25 transition-all"
                  >
                    <div className="flex items-center space-x-2 overflow-hidden flex-1">
                      <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                      <span className="text-sm font-bold text-white/95 truncate">
                        {ev.text}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all shrink-0"
                      aria-label="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>

            <form onSubmit={handleAddEvent} className="relative group pt-1">
              <input
                type="text"
                value={newEvent}
                onChange={(e) => setNewEvent(e.target.value)}
                placeholder="予定を追加（例: 家族で外食、参観日）..."
                className="w-full pl-4 pr-11 py-2.5 bg-black/30 border border-white/15 focus:border-purple-400/60 rounded-xl text-sm font-medium focus:bg-black/50 focus:ring-2 focus:ring-purple-400/20 outline-none transition-all placeholder:text-white/35 text-white"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-[calc(50%+2px)] -translate-y-1/2 p-1.5 bg-purple-500/30 hover:bg-purple-500/50 active:scale-90 text-purple-200 rounded-lg transition-all border border-purple-400/30"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>

        {/* ＝＝＝ 3. 献立セクション ＝＝＝ */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center space-x-2 text-emerald-300">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30">
                <Utensils className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm tracking-wide">
                献立 ({safeMeals.length})
              </h4>
            </div>
          </div>

          <div className="space-y-2">
            <AnimatePresence>
              {safeMeals.length === 0 ? (
                <p className="text-xs text-white/40 py-3 text-center bg-white/[0.04] rounded-xl border border-white/5 font-medium">
                  まだ献立は登録されていません
                </p>
              ) : (
                safeMeals.map((meal, index) => (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={`meal-${index}`}
                    className="flex items-center justify-between p-3 bg-white/[0.08] backdrop-blur-md border border-white/15 rounded-xl shadow-md group hover:bg-white/[0.12] transition-all"
                  >
                    <span className="text-sm font-bold text-white/95 truncate pr-3">
                      {meal}
                    </span>
                    <button
                      onClick={() => handleDeleteMeal(index)}
                      className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all shrink-0"
                      aria-label="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>

            <form onSubmit={handleAddMeal} className="relative group pt-1">
              <input
                type="text"
                value={newMeal}
                onChange={(e) => setNewMeal(e.target.value)}
                placeholder="献立を追加（例: カレーライス、ハンバーグ）..."
                className="w-full pl-4 pr-11 py-2.5 bg-black/30 border border-white/15 focus:border-emerald-400/60 rounded-xl text-sm font-medium focus:bg-black/50 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all placeholder:text-white/35 text-white"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-[calc(50%+2px)] -translate-y-1/2 p-1.5 bg-emerald-500/30 hover:bg-emerald-500/50 active:scale-90 text-emerald-200 rounded-lg transition-all border border-emerald-400/30"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>

        {/* ＝＝＝ 4. 買うものセクション ＝＝＝ */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center space-x-2 text-teal-300">
              <div className="p-1.5 rounded-lg bg-teal-500/20 border border-teal-400/30">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-sm tracking-wide">
                この日の買い物 ({safeShopping.length})
              </h4>
            </div>
          </div>

          <div className="space-y-2">
            <AnimatePresence>
              {safeShopping.length === 0 ? (
                <p className="text-xs text-white/40 py-3 text-center bg-white/[0.04] rounded-xl border border-white/5 font-medium">
                  登録された買い物はありません
                </p>
              ) : (
                safeShopping.map((item, index) => {
                  const cat = getCategoryInfo(item.category || detectCategory(item.text));
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={item.id ? `shop-${item.id}` : `shop-${index}`}
                      onClick={() => toggleShoppingCheck(item.id)}
                      className={clsx(
                        "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border backdrop-blur-md group",
                        item.checked
                          ? "bg-black/40 border-white/5 opacity-50"
                          : "bg-white/[0.08] border-white/15 hover:bg-white/[0.12] hover:border-teal-400/40 shadow-md"
                      )}
                    >
                      <div className="flex items-center space-x-3 overflow-hidden flex-1">
                        {item.checked ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-white/40 shrink-0 group-hover:text-emerald-300 transition-colors" />
                        )}
                        <span className="text-xs shrink-0">{cat.emoji}</span>
                        <span
                          className={clsx(
                            "text-sm font-bold truncate pr-2 transition-all",
                            item.checked
                              ? "line-through text-white/40"
                              : "text-white/95"
                          )}
                        >
                          {item.text}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteShopping(item.id);
                        }}
                        className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all shrink-0"
                        aria-label="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>

            <form onSubmit={handleAddShopping} className="relative group pt-1">
              <input
                type="text"
                value={newShopping}
                onChange={(e) => setNewShopping(e.target.value)}
                placeholder="買うものを追加（例: 玉ねぎ、牛乳）..."
                className="w-full pl-4 pr-11 py-2.5 bg-black/30 border border-white/15 focus:border-teal-400/60 rounded-xl text-sm font-medium focus:bg-black/50 focus:ring-2 focus:ring-teal-400/20 outline-none transition-all placeholder:text-white/35 text-white"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-[calc(50%+2px)] -translate-y-1/2 p-1.5 bg-teal-500/30 hover:bg-teal-500/50 active:scale-90 text-teal-200 rounded-lg transition-all border border-teal-400/30"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

// ＝＝＝ 画面フルストレッチのカレンダーマス（セル） ＝＝＝
const CalendarCell = ({
  cellDate,
  familyId,
  isSelected,
  isToday,
  dayOfWeekIndex,
  onClick,
}: {
  cellDate: CellDate;
  familyId: string;
  isSelected: boolean;
  isToday: boolean;
  dayOfWeekIndex: number;
  onClick: () => void;
}) => {
  const [data, setData] = useState<DayData | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { year, month, day, isCurrentMonth, dateKey } = cellDate;
  const holiday = getJapaneseHoliday(year, month, day);

  useEffect(() => {
    if (!familyId || !dateKey) return;
    const unsubscribe = onSnapshot(
      doc(db, "users", familyId, "calendar", dateKey),
      (docSnap) => {
        if (docSnap.exists()) {
          const raw = docSnap.data();
          const rawEvents = Array.isArray(raw?.events) ? raw.events : [];
          const safeEvents: CalendarEvent[] = rawEvents.map((item: any, idx: number) => {
            if (typeof item === "string") return { id: `ev-${idx}`, text: item };
            return { id: item.id || `ev-${idx}`, text: item.text || item.title || "" };
          });
          setData({
            meals: Array.isArray(raw?.meals) ? raw.meals : [],
            shopping: Array.isArray(raw?.shopping) ? raw.shopping : [],
            events: safeEvents,
          });
        } else {
          setData(null);
        }
      }
    );
    return () => unsubscribe();
  }, [familyId, dateKey]);

  const handleDragStart = (e: React.DragEvent, type: "meal" | "shopping", item: any) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ sourceDateKey: dateKey, type, item })
    );
    e.dataTransfer.effectAllowed = "copyMove";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dataStr = e.dataTransfer.getData("application/json");
    if (!dataStr) return;

    try {
      const { sourceDateKey, type, item } = JSON.parse(dataStr);
      if (sourceDateKey === dateKey) return;
      const sourceRef = doc(db, "users", familyId, "calendar", sourceDateKey);
      const targetRef = doc(db, "users", familyId, "calendar", dateKey);
      const isCopy = e.ctrlKey || e.metaKey;

      if (type === "meal") {
        if (!isCopy) await setDoc(sourceRef, { meals: arrayRemove(item) }, { merge: true });
        await setDoc(targetRef, { meals: arrayUnion(item) }, { merge: true });
      } else if (type === "shopping") {
        if (!isCopy) await setDoc(sourceRef, { shopping: arrayRemove(item) }, { merge: true });
        const itemToAdd = isCopy
          ? { ...item, id: Date.now().toString() + Math.random().toString(36).substring(2, 5) }
          : item;
        await setDoc(targetRef, { shopping: arrayUnion(itemToAdd) }, { merge: true });
      }
    } catch (error) {
      console.error("D&D Error:", error);
    }
  };

  const meals = Array.isArray(data?.meals) ? data.meals : [];
  const shopping = Array.isArray(data?.shopping) ? data.shopping : [];
  const events = Array.isArray(data?.events) ? data.events : [];

  const firstEvent = events[0];
  const firstMeal = meals[0];
  const firstShopping = shopping.find((item) => item && !item.checked);

  // 日曜(0)または祝日は赤、土曜(6)は青、平日は白
  const isSundayOrHoliday = dayOfWeekIndex === 0 || !!holiday;
  const isSaturday = dayOfWeekIndex === 6 && !holiday;

  return (
    <div
      onClick={() => {
        triggerHaptic("light");
        onClick();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = e.ctrlKey || e.metaKey ? "copy" : "move";
      }}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={clsx(
        "relative w-full h-full p-1 lg:p-1.5 flex flex-col text-left transition-all border-b border-r border-white/10 select-none cursor-pointer overflow-hidden group",
        // 当月以外は薄く（TimeTree風）
        !isCurrentMonth && "opacity-35 bg-black/15",
        // 選択中
        isSelected
          ? "bg-emerald-500/25 ring-2 ring-emerald-400 z-10 shadow-[inset_0_0_15px_rgba(16,185,129,0.3)]"
          : isToday
          ? "bg-emerald-500/10 hover:bg-emerald-500/20"
          : "hover:bg-white/[0.06]",
        isDragOver && "bg-emerald-500/30 ring-2 ring-emerald-300"
      )}
    >
      {/* ＝＝＝ 日付＆祝日ヘッダー ＝＝＝ */}
      <div className="flex items-center justify-between mb-0.5 leading-none">
        {/* 今日のサークルハイライト（TimeTree・Googleカレンダー風） */}
        {isToday ? (
          <span className="w-5 h-5 lg:w-6 lg:h-6 rounded-full bg-emerald-400 text-[#07160e] font-black text-[11px] lg:text-xs flex items-center justify-center shadow-md">
            {day}
          </span>
        ) : (
          <span
            className={clsx(
              "text-xs lg:text-sm font-extrabold drop-shadow pl-0.5",
              isSundayOrHoliday
                ? "text-rose-400"
                : isSaturday
                ? "text-sky-400"
                : "text-white/90"
            )}
          >
            {day}
          </span>
        )}

        {/* 祝日バッジ */}
        {holiday && isCurrentMonth && (
          <span className="text-[9px] font-black text-rose-300/90 truncate max-w-[50px] lg:max-w-none">
            {holiday}
          </span>
        )}
      </div>

      {/* ＝＝＝ バッジ表示エリア（予定・献立・買い物） ＝＝＝ */}
      <div className="flex flex-col gap-0.5 w-full flex-1 overflow-hidden mt-0.5">
        {/* 1. 予定バッジ（パープル） */}
        {firstEvent && (
          <div className="w-full text-[9px] lg:text-[11px] font-bold px-1 py-0.5 rounded bg-purple-500/35 text-purple-100 border border-purple-400/30 truncate flex items-center shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-300 mr-1 shrink-0" />
            <span className="truncate pointer-events-none">{firstEvent.text}</span>
          </div>
        )}

        {/* 2. 献立バッジ（エメラルド） */}
        {firstMeal && (
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              handleDragStart(e, "meal", firstMeal);
            }}
            className="cursor-grab active:cursor-grabbing w-full text-[9px] lg:text-[11px] font-bold px-1 py-0.5 rounded bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 truncate flex items-center shadow-sm hover:bg-emerald-500/50 transition-colors"
          >
            <Utensils className="w-2.5 h-2.5 shrink-0 mr-1 text-emerald-300 opacity-90" />
            <span className="truncate pointer-events-none">{firstMeal}</span>
          </div>
        )}

        {/* 3. 買い物バッジ（ティール） */}
        {firstShopping && (
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              handleDragStart(e, "shopping", firstShopping);
            }}
            className="cursor-grab active:cursor-grabbing w-full text-[9px] lg:text-[11px] font-bold px-1 py-0.5 rounded bg-teal-500/30 text-teal-100 border border-teal-400/30 truncate flex items-center shadow-sm hover:bg-teal-500/50 transition-colors"
          >
            <ShoppingCart className="w-2.5 h-2.5 shrink-0 mr-1 text-teal-300 opacity-90" />
            <span className="truncate pointer-events-none">{firstShopping.text}</span>
          </div>
        )}

        {/* 複数ある場合の「+N」インジケーター */}
        {meals.length + events.length + shopping.filter((i) => !i.checked).length > 2 && (
          <span className="text-[8px] font-bold text-white/50 pl-0.5">
            他 +{meals.length + events.length + shopping.filter((i) => !i.checked).length - 2}件
          </span>
        )}
      </div>
    </div>
  );
};

// ＝＝＝ 前月・翌月も含めて隙間なく42マスを埋める生成関数 ＝＝＝
const getFullCalendarGrid = (year: number, month: number): CellDate[] => {
  const daysInCurrentMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0(日) 〜 6(土)
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const cells: CellDate[] = [];

  // 1. 前月の日付で先頭の穴埋め
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonthDate = new Date(year, month - 2, day);
    const pYear = prevMonthDate.getFullYear();
    const pMonth = prevMonthDate.getMonth() + 1;
    cells.push({
      year: pYear,
      month: pMonth,
      day,
      isCurrentMonth: false,
      dateKey: `${pYear}-${String(pMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }

  // 2. 当月の日付
  for (let day = 1; day <= daysInCurrentMonth; day++) {
    cells.push({
      year,
      month,
      day,
      isCurrentMonth: true,
      dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }

  // 3. 翌月の日付で末尾の穴埋め（合計42マス = 7列 × 6行 に均一化）
  const remaining = 42 - cells.length;
  for (let day = 1; day <= remaining; day++) {
    const nextMonthDate = new Date(year, month, day);
    const nYear = nextMonthDate.getFullYear();
    const nMonth = nextMonthDate.getMonth() + 1;
    cells.push({
      year: nYear,
      month: nMonth,
      day,
      isCurrentMonth: false,
      dateKey: `${nYear}-${String(nMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }

  return cells;
};

const variants = {
  enter: (direction: number) => ({ x: direction > 0 ? 250 : -250, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -250 : 250, opacity: 0 }),
};

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCell, setSelectedCell] = useState<CellDate | null>(null);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          if (isMounted) {
            const currentFamilyId =
              userSnap.exists() && userSnap.data()?.familyId
                ? userSnap.data().familyId
                : user.uid;
            setFamilyId(currentFamilyId);
          }
        } catch (err) {
          console.warn("ユーザー情報の取得でエラー:", err);
          if (isMounted) setFamilyId(user.uid);
        } finally {
          if (isMounted) setIsLoading(false);
        }
      } else {
        router.push("/login");
        if (isMounted) setIsLoading(false);
      }
    });

    const safetyTimer = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 2000);

    return () => {
      isMounted = false;
      unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [router]);

  const changeMonth = (offset: number) => {
    triggerHaptic("light");
    setDirection(offset);
    setSelectedCell(null);
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const goToToday = () => {
    triggerHaptic("medium");
    const today = new Date();
    setCurrentDate(today);
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setSelectedCell({
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
      isCurrentMonth: true,
      dateKey: todayKey,
    });
  };

  const handleDragEnd = (e: any, { offset }: any) => {
    if (offset.x > 60) changeMonth(-1);
    else if (offset.x < -60) changeMonth(1);
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const gridCells = getFullCalendarGrid(currentYear, currentMonth);

  const today = new Date();
  const isThisMonth =
    today.getFullYear() === currentYear && today.getMonth() + 1 === currentMonth;

  // 前日・翌日ナビゲーション
  const goToPrevDay = () => {
    if (!selectedCell) return;
    const cur = new Date(selectedCell.year, selectedCell.month - 1, selectedCell.day - 1);
    const prevKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    setSelectedCell({
      year: cur.getFullYear(),
      month: cur.getMonth() + 1,
      day: cur.getDate(),
      isCurrentMonth: cur.getMonth() + 1 === currentMonth,
      dateKey: prevKey,
    });
  };

  const goToNextDay = () => {
    if (!selectedCell) return;
    const cur = new Date(selectedCell.year, selectedCell.month - 1, selectedCell.day + 1);
    const nextKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    setSelectedCell({
      year: cur.getFullYear(),
      month: cur.getMonth() + 1,
      day: cur.getDate(),
      isCurrentMonth: cur.getMonth() + 1 === currentMonth,
      dateKey: nextKey,
    });
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="relative min-h-screen text-white flex overflow-hidden">
      {/* ＝＝＝ 森林フロスト背景 ＝＝＝ */}
      <div className="fixed inset-0 -z-50 pointer-events-none overflow-hidden bg-[#07160e]">
        <img
          src="https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=2000&auto=format&fit=crop"
          alt="Forest background"
          className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-luminosity scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07160e]/80 via-[#07160e]/70 to-[#040e08]/95" />
        <motion.div
          animate={{ x: ["-15vw", "10vw", "-15vw"], y: ["-10vh", "15vh", "-10vh"] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[70vw] h-[70vh] rounded-full bg-emerald-600/15 blur-[120px]"
        />
        <motion.div
          animate={{ x: ["15vw", "-10vw", "15vw"], y: ["15vh", "-15vh", "15vh"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-[10%] -right-[10%] w-[65vw] h-[65vh] rounded-full bg-teal-700/20 blur-[120px]"
        />
        <div className="absolute inset-0 backdrop-blur-[2px] bg-black/20" />
      </div>

      <div className="relative z-10 flex items-start flex-1 min-h-screen">
        {/* メインカレンダーエリア：画面の縦横を100%フルストレッチ */}
        <div className="flex-1 min-w-0 p-2 lg:p-6 pb-20 md:pb-6 flex flex-col h-[calc(100dvh-calc(env(safe-area-inset-top,0px)+12px))]">
          {/* ＝＝＝ ヘッダー ＝＝＝ */}
          <div className="flex items-center justify-between mb-2 pr-12 md:pr-0 shrink-0">
            <div className="flex items-center space-x-2 lg:space-x-3">
              <h2 className="text-lg lg:text-2xl font-black text-white drop-shadow tracking-tight">
                {currentYear}年 {currentMonth}月
              </h2>

              {/* 前月・次月送りボタン */}
              <div className="flex space-x-1 ml-1">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  className="p-1.5 bg-white/[0.08] hover:bg-white/[0.18] active:scale-95 rounded-xl border border-white/15 transition-all text-white"
                  aria-label="前月"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  className="p-1.5 bg-white/[0.08] hover:bg-white/[0.18] active:scale-95 rounded-xl border border-white/15 transition-all text-white"
                  aria-label="次月"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* 「今日」クイックジャンプボタン */}
              <button
                type="button"
                onClick={goToToday}
                className={clsx(
                  "px-2.5 py-1 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center space-x-1 shadow-sm",
                  isThisMonth && selectedCell?.day === today.getDate()
                    ? "bg-emerald-500/35 text-emerald-200 border border-emerald-400/50"
                    : "bg-white/[0.08] hover:bg-white/[0.18] text-white/85 border border-white/15"
                )}
              >
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-300" />
                <span>今日</span>
              </button>
            </div>
          </div>

          {/* ＝＝＝ 曜日ヘッダー ＝＝＝ */}
          <div className="grid grid-cols-7 border-b border-white/15 bg-white/[0.04] backdrop-blur-md rounded-t-xl shrink-0">
            {["日", "月", "火", "水", "木", "金", "土"].map((day, i) => (
              <div
                key={`weekday-${day}-${i}`}
                className={clsx(
                  "text-center text-xs lg:text-sm font-extrabold py-1.5 drop-shadow",
                  i === 0
                    ? "text-rose-400"
                    : i === 6
                    ? "text-sky-400"
                    : "text-white/80"
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* ＝＝＝ 42マス フルストレッチ カレンダーグリッド（TimeTree・Googleカレンダー風） ＝＝＝ */}
          <div className="relative flex-1 border-l border-t border-white/10 rounded-b-xl overflow-hidden bg-black/20 backdrop-blur-xl">
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={currentDate.toString()}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 320, damping: 32 },
                  opacity: { duration: 0.15 },
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                className="absolute inset-0 grid grid-cols-7 grid-rows-6 w-full h-full"
              >
                {gridCells.map((cell, idx) => {
                  const dayOfWeekIdx = idx % 7;
                  const isTodayCell =
                    isThisMonth &&
                    cell.isCurrentMonth &&
                    today.getDate() === cell.day;

                  return (
                    <CalendarCell
                      key={`grid-${cell.dateKey}-${idx}`}
                      cellDate={cell}
                      familyId={familyId || ""}
                      isSelected={selectedCell?.dateKey === cell.dateKey}
                      isToday={isTodayCell}
                      dayOfWeekIndex={dayOfWeekIdx}
                      onClick={() => setSelectedCell(cell)}
                    />
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ＝＝＝ 右下の「＋」フローティングアクションボタン（FAB） ＝＝＝ */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            triggerHaptic("medium");
            if (!selectedCell) goToToday();
          }}
          className="fixed right-4 bottom-24 md:bottom-8 z-30 w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-[0_8px_25px_rgba(16,185,129,0.4)] border border-white/30 backdrop-blur-md"
          aria-label="クイック追加"
        >
          <Plus className="w-7 h-7 stroke-[2.5]" />
        </motion.button>

        {/* ＝＝＝ 右側（PC）/ 下部（スマホ）の詳細パネル ＝＝＝ */}
        {selectedCell && familyId && (
          <>
            {/* PC用右サイドパネル */}
            <div className="hidden lg:block sticky top-0 w-[420px] h-screen border-l border-white/15 bg-black/45 backdrop-blur-2xl shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-20 p-7">
              <DetailContent
                year={selectedCell.year}
                month={selectedCell.month}
                day={selectedCell.day}
                dateKey={selectedCell.dateKey}
                familyId={familyId}
                onClose={() => setSelectedCell(null)}
                onPrevDay={goToPrevDay}
                onNextDay={goToNextDay}
              />
            </div>

            {/* スマホ用ボトムシート */}
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedCell(null)}
                className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="lg:hidden fixed inset-x-0 bottom-0 z-50 h-[82vh] rounded-t-[2.5rem] shadow-[0_-15px_50px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col border-t border-white/20 bg-[#091711]/95 backdrop-blur-2xl"
              >
                <DetailContent
                  year={selectedCell.year}
                  month={selectedCell.month}
                  day={selectedCell.day}
                  dateKey={selectedCell.dateKey}
                  familyId={familyId}
                  onClose={() => setSelectedCell(null)}
                  onPrevDay={goToPrevDay}
                  onNextDay={goToNextDay}
                  isMobile={true}
                />
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}