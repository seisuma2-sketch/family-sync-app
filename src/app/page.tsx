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

type DayData = {
  meals: string[];
  shopping: ShoppingItem[];
};

// ＝＝＝ 詳細パネル / ボトムシート ＝＝＝
const DetailContent = ({
  dateKey,
  displayDate,
  familyId,
  onClose,
  onPrevDay,
  onNextDay,
  isMobile = false,
}: {
  dateKey: string;
  displayDate: string;
  familyId: string;
  onClose: () => void;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  isMobile?: boolean;
}) => {
  const [data, setData] = useState<DayData>({ meals: [], shopping: [] });
  const [newMeal, setNewMeal] = useState("");
  const [newShopping, setNewShopping] = useState("");

  useEffect(() => {
    if (!familyId || !dateKey) return;
    const unsubscribe = onSnapshot(
      doc(db, "users", familyId, "calendar", dateKey),
      (docSnap) => {
        if (docSnap.exists()) {
          const raw = docSnap.data();
          setData({
            meals: Array.isArray(raw?.meals) ? raw.meals : [],
            shopping: Array.isArray(raw?.shopping) ? raw.shopping : [],
          });
        } else {
          setData({ meals: [], shopping: [] });
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

  const handleAddMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeal.trim()) return;
    triggerHaptic("medium");
    const currentMeals = Array.isArray(data.meals) ? data.meals : [];
    saveToFirestore({ ...data, meals: [...currentMeals, newMeal.trim()] });
    setNewMeal("");
  };

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

  const handleDeleteMeal = (indexToRemove: number) => {
    triggerHaptic("medium");
    const currentMeals = Array.isArray(data.meals) ? data.meals : [];
    const updatedMeals = currentMeals.filter((_, index) => index !== indexToRemove);
    saveToFirestore({ ...data, meals: updatedMeals });
  };

  const handleDeleteShopping = (idToRemove: string) => {
    triggerHaptic("medium");
    const currentShopping = Array.isArray(data.shopping) ? data.shopping : [];
    const updatedShopping = currentShopping.filter((item) => item.id !== idToRemove);
    saveToFirestore({ ...data, shopping: updatedShopping });
  };

  const safeMeals = Array.isArray(data?.meals) ? data.meals : [];
  const safeShopping = Array.isArray(data?.shopping) ? data.shopping : [];

  return (
    <div className="h-full flex flex-col text-white">
      {/* ヘッダーエリア */}
      {isMobile ? (
        <div className="relative pt-3 pb-4 px-5 border-b border-white/10 shrink-0">
          {/* さらさらグラブバー */}
          <div className="w-12 h-1.5 bg-white/25 rounded-full mx-auto mb-3" />
          
          <div className="flex items-center justify-between">
            {/* 前日・翌日ナビゲーション */}
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
              <h3 className="font-extrabold text-lg px-2 text-white drop-shadow">
                {displayDate}
              </h3>
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

            {/* 閉じるボタン */}
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
        <div className="mb-6 shrink-0 flex items-center justify-between border-b border-white/10 pb-4">
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
            <h3 className="text-2xl font-extrabold drop-shadow-md text-white px-1">
              {displayDate}
            </h3>
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

      {/* スクロールコンテンツ */}
      <div
        className={clsx(
          "flex-1 overflow-y-auto space-y-6 pb-28",
          isMobile ? "p-5" : "pr-1"
        )}
      >
        {/* ＝＝＝ 献立セクション ＝＝＝ */}
        <section>
          <div className="flex items-center justify-between mb-3">
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
                <p className="text-xs text-white/40 py-4 text-center bg-white/[0.04] rounded-2xl border border-white/5">
                  まだ献立は登録されていません
                </p>
              ) : (
                safeMeals.map((meal, index) => (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={`meal-${index}`}
                    className="flex items-center justify-between p-3 bg-white/[0.08] backdrop-blur-md border border-white/15 rounded-2xl shadow-md group hover:bg-white/[0.12] transition-all"
                  >
                    <span className="text-sm font-bold text-white/95 truncate pr-3">
                      {meal}
                    </span>
                    <button
                      onClick={() => handleDeleteMeal(index)}
                      className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all shrink-0"
                      aria-label="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>

            {/* 献立追加フォーム */}
            <form onSubmit={handleAddMeal} className="relative group pt-1">
              <input
                type="text"
                value={newMeal}
                onChange={(e) => setNewMeal(e.target.value)}
                placeholder="献立を追加（例: カレーライス）..."
                className="w-full pl-4 pr-11 py-3 bg-black/30 border border-white/15 focus:border-emerald-400/60 rounded-2xl text-sm font-medium focus:bg-black/50 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all placeholder:text-white/35 text-white"
              />
              <button
                type="submit"
                className="absolute right-2 top-[calc(50%+2px)] -translate-y-1/2 p-2 bg-emerald-500/30 hover:bg-emerald-500/50 active:scale-90 text-emerald-200 rounded-xl transition-all border border-emerald-400/30"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>

        {/* ＝＝＝ 買うものセクション ＝＝＝ */}
        <section>
          <div className="flex items-center justify-between mb-3">
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
                <p className="text-xs text-white/40 py-4 text-center bg-white/[0.04] rounded-2xl border border-white/5">
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
                        "flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border backdrop-blur-md group",
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
                        className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all shrink-0"
                        aria-label="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>

            {/* 買い物追加フォーム */}
            <form onSubmit={handleAddShopping} className="relative group pt-1">
              <input
                type="text"
                value={newShopping}
                onChange={(e) => setNewShopping(e.target.value)}
                placeholder="買うものを追加（例: 玉ねぎ、牛乳）..."
                className="w-full pl-4 pr-11 py-3 bg-black/30 border border-white/15 focus:border-teal-400/60 rounded-2xl text-sm font-medium focus:bg-black/50 focus:ring-2 focus:ring-teal-400/20 outline-none transition-all placeholder:text-white/35 text-white"
              />
              <button
                type="submit"
                className="absolute right-2 top-[calc(50%+2px)] -translate-y-1/2 p-2 bg-teal-500/30 hover:bg-teal-500/50 active:scale-90 text-teal-200 rounded-xl transition-all border border-teal-400/30"
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

// ＝＝＝ カレンダーマス（セル）コンポーネント ＝＝＝
const CalendarCell = ({
  day,
  year,
  month,
  familyId,
  isSelected,
  isToday,
  onClick,
}: {
  day: number;
  year: number;
  month: number;
  familyId: string;
  isSelected: boolean;
  isToday: boolean;
  onClick: () => void;
}) => {
  const [data, setData] = useState<DayData | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  useEffect(() => {
    if (!familyId || !day) return;
    const unsubscribe = onSnapshot(
      doc(db, "users", familyId, "calendar", dateKey),
      (docSnap) => {
        if (docSnap.exists()) {
          const raw = docSnap.data();
          setData({
            meals: Array.isArray(raw?.meals) ? raw.meals : [],
            shopping: Array.isArray(raw?.shopping) ? raw.shopping : [],
          });
        } else {
          setData(null);
        }
      }
    );
    return () => unsubscribe();
  }, [familyId, year, month, day, dateKey]);

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
  const firstMeal = meals[0];
  const firstShopping = shopping.find((item) => item && !item.checked);

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
        "w-full h-full p-1.5 lg:p-2.5 rounded-2xl border transition-all text-left flex flex-col backdrop-blur-xl overflow-hidden cursor-pointer active:scale-[0.98]",
        isSelected
          ? "bg-emerald-500/30 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-2 ring-emerald-400"
          : isToday
          ? "bg-emerald-500/15 border-emerald-400/50 shadow-md ring-1 ring-emerald-400/40 hover:bg-emerald-500/25 hover:border-emerald-300"
          : "bg-white/[0.07] border-white/[0.12] hover:bg-white/[0.12] hover:border-white/30 shadow-md",
        isDragOver && "ring-2 ring-emerald-300 bg-emerald-500/30"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={clsx(
            "text-xs lg:text-base font-extrabold drop-shadow pointer-events-none",
            isToday ? "text-emerald-300" : "text-white"
          )}
        >
          {day}
        </span>
        {isToday && (
          <span className="hidden lg:inline-block text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
            今日
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 w-full flex-1 overflow-hidden">
        {firstMeal && (
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              handleDragStart(e, "meal", firstMeal);
            }}
            className="cursor-grab active:cursor-grabbing w-full text-[10px] lg:text-xs font-bold px-1.5 py-0.5 lg:py-1 rounded-lg bg-emerald-500/25 text-emerald-100 border border-emerald-400/30 truncate shadow-sm flex items-center hover:bg-emerald-500/40 transition-colors"
          >
            <Utensils className="w-2.5 h-2.5 lg:w-3 lg:h-3 shrink-0 mr-1 text-emerald-300 opacity-90" />
            <span className="truncate pointer-events-none">{firstMeal}</span>
          </div>
        )}
        {firstShopping && (
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              handleDragStart(e, "shopping", firstShopping);
            }}
            className="cursor-grab active:cursor-grabbing w-full text-[10px] lg:text-xs font-bold px-1.5 py-0.5 lg:py-1 rounded-lg bg-teal-500/25 text-teal-100 border border-teal-400/30 truncate shadow-sm flex items-center hover:bg-teal-500/40 transition-colors"
          >
            <ShoppingCart className="w-2.5 h-2.5 lg:w-3 lg:h-3 shrink-0 mr-1 text-teal-300 opacity-90" />
            <span className="truncate pointer-events-none">{firstShopping.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const getCalendarData = (year: number, month: number) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  return Array.from({ length: 42 }).map((_, i) => {
    const day = i - firstDayOfMonth + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
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
  // 初期選択はあえてnull（スマホですぐにドロワーが開いて邪魔にならないようにする）
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
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
          console.warn("ユーザー情報の取得でエラー（UIDを使用します）:", err);
          if (isMounted) {
            setFamilyId(user.uid);
          }
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
    setSelectedDay(null);
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const goToToday = () => {
    triggerHaptic("medium");
    const today = new Date();
    setCurrentDate(today);
    setSelectedDay(today.getDate());
  };

  const handleDragEnd = (e: any, { offset }: any) => {
    if (offset.x > 60) changeMonth(-1);
    else if (offset.x < -60) changeMonth(1);
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const calendarDays = getCalendarData(currentYear, currentMonth);
  const selectedDateKey = selectedDay
    ? `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : "";
  const displayDateStr = selectedDay ? `${currentMonth}月${selectedDay}日` : "";

  // 「前日」「翌日」への切り替え関数
  const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();
  const goToPrevDay = () => {
    if (!selectedDay) return;
    if (selectedDay > 1) {
      setSelectedDay(selectedDay - 1);
    } else {
      // 前月の末日へ
      const prevDate = new Date(currentYear, currentMonth - 2, 1);
      const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
      setCurrentDate(prevDate);
      setSelectedDay(prevMonthDays);
    }
  };

  const goToNextDay = () => {
    if (!selectedDay) return;
    if (selectedDay < daysInCurrentMonth) {
      setSelectedDay(selectedDay + 1);
    } else {
      // 翌月の1日へ
      const nextDate = new Date(currentYear, currentMonth, 1);
      setCurrentDate(nextDate);
      setSelectedDay(1);
    }
  };

  const today = new Date();
  const isThisMonth =
    today.getFullYear() === currentYear && today.getMonth() + 1 === currentMonth;

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="relative min-h-screen text-white flex overflow-hidden">
      {/* ＝＝＝ ログイン画面と同じ「さらさら森林フロスト背景」 ＝＝＝ */}
      <div className="fixed inset-0 -z-50 pointer-events-none overflow-hidden bg-[#07160e]">
        {/* 自然の森のテクスチャ */}
        <img
          src="https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=2000&auto=format&fit=crop"
          alt="Forest background"
          className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity scale-105"
        />

        {/* 深緑の落ち着いたグラデーション */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#07160e]/80 via-[#07160e]/70 to-[#040e08]/95" />

        {/* 巨大なさらさら光のオーブ 1（柔らかいエメラルド） */}
        <motion.div
          animate={{
            x: ["-15vw", "10vw", "-15vw"],
            y: ["-10vh", "15vh", "-10vh"],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[70vw] h-[70vh] rounded-full bg-emerald-600/15 blur-[120px]"
        />

        {/* 巨大なさらさら光のオーブ 2（深いティール・ブルーグリーン） */}
        <motion.div
          animate={{
            x: ["15vw", "-10vw", "15vw"],
            y: ["15vh", "-15vh", "15vh"],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-[10%] -right-[10%] w-[65vw] h-[65vh] rounded-full bg-teal-700/20 blur-[120px]"
        />

        {/* 全体の眩しさを抑え、文字を圧倒的に読みやすくする微細フロストフィルター */}
        <div className="absolute inset-0 backdrop-blur-[2px] bg-black/20" />
      </div>

      <div className="relative z-10 flex items-start flex-1 min-h-screen">
        <div className="flex-1 min-w-0 p-3 lg:p-10 pb-28 lg:pb-8 flex flex-col h-full min-h-[calc(100dvh-calc(env(safe-area-inset-top,0px)+12px))] md:h-screen">
          {/* ＝＝＝ ヘッダーエリア ＝＝＝ */}
          <div className="flex items-center justify-between mb-3 lg:mb-6 pr-12 md:pr-0">
            <div className="flex items-center space-x-2 lg:space-x-4">
              <h2 className="text-xl lg:text-3xl font-extrabold text-white drop-shadow-md tracking-tight">
                {currentYear}年 {currentMonth}月
              </h2>
              <div className="flex space-x-1 ml-1 lg:ml-4">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  className="p-1.5 lg:p-2 bg-white/[0.08] hover:bg-white/[0.18] active:scale-95 backdrop-blur-xl border border-white/15 rounded-xl shadow-md transition-all text-white"
                  aria-label="前月"
                >
                  <ChevronLeft className="w-4 h-4 lg:w-5 lg:h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  className="p-1.5 lg:p-2 bg-white/[0.08] hover:bg-white/[0.18] active:scale-95 backdrop-blur-xl border border-white/15 rounded-xl shadow-md transition-all text-white"
                  aria-label="次月"
                >
                  <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
                </button>
              </div>

              {/* 「今日」クイックジャンプボタン */}
              <button
                type="button"
                onClick={goToToday}
                className={clsx(
                  "px-2.5 py-1 lg:px-3 lg:py-1.5 rounded-xl text-xs font-bold transition-all backdrop-blur-xl active:scale-95 flex items-center space-x-1.5 shadow-md",
                  isThisMonth && selectedDay === today.getDate()
                    ? "bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    : "bg-white/[0.08] hover:bg-white/[0.18] text-white/85 border border-white/15"
                )}
              >
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-300" />
                <span>今日</span>
              </button>
            </div>
          </div>

          {/* ＝＝＝ 曜日ヘッダー ＝＝＝ */}
          <div className="grid grid-cols-7 gap-1 lg:gap-3 mb-2 lg:mb-3">
            {["日", "月", "火", "水", "木", "金", "土"].map((day, i) => (
              <div
                key={`weekday-${day}-${i}`}
                className={clsx(
                  "text-center text-xs lg:text-sm font-extrabold drop-shadow py-1",
                  i === 0
                    ? "text-rose-400"
                    : i === 6
                    ? "text-sky-400"
                    : "text-white/70"
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* ＝＝＝ カレンダーグリッド ＝＝＝ */}
          <div className="relative flex-1">
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={currentDate.toString()}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                className="absolute inset-0 overflow-y-auto overflow-x-hidden pb-24 lg:pb-6 grid grid-cols-7 gap-1 lg:gap-3 grid-rows-[repeat(6,minmax(68px,1fr))] lg:grid-rows-[repeat(6,minmax(100px,1fr))] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              >
                {calendarDays.map((day, i) => (
                  <div key={`cal-grid-${i}-${day ?? "empty"}`} className="w-full h-full">
                    {day && familyId ? (
                      <CalendarCell
                        day={day}
                        year={currentYear}
                        month={currentMonth}
                        familyId={familyId}
                        isSelected={selectedDay === day}
                        isToday={isThisMonth && today.getDate() === day}
                        onClick={() => setSelectedDay(day)}
                      />
                    ) : (
                      <div className="w-full h-full bg-transparent" />
                    )}
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ＝＝＝ 右側（PC）/ 下部（スマホ）の詳細パネル ＝＝＝ */}
        {selectedDay && familyId && (
          <>
            {/* PC用右サイドパネル（さらさらフロストガラス） */}
            <div className="hidden lg:block sticky top-0 w-[400px] h-screen border-l border-white/15 bg-black/40 backdrop-blur-2xl shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-20 p-8">
              <DetailContent
                dateKey={selectedDateKey}
                displayDate={displayDateStr}
                familyId={familyId}
                onClose={() => setSelectedDay(null)}
                onPrevDay={goToPrevDay}
                onNextDay={goToNextDay}
              />
            </div>

            {/* スマホ用ボトムシート（さらさらフロストガラス） */}
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedDay(null)}
                className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="lg:hidden fixed inset-x-0 bottom-0 z-50 h-[80vh] rounded-t-[2.5rem] shadow-[0_-15px_50px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col border-t border-white/20 bg-[#091711]/95 backdrop-blur-2xl"
              >
                <DetailContent
                  dateKey={selectedDateKey}
                  displayDate={displayDateStr}
                  familyId={familyId}
                  onClose={() => setSelectedDay(null)}
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