"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Utensils, ShoppingCart, Plus, CheckCircle2, Circle, LogOut, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc, arrayRemove, arrayUnion } from "firebase/firestore"; 
import { auth, db } from "@/lib/firebase";
import { detectCategory, getCategoryInfo } from "@/lib/shoppingCategories";

const LoadingScreen = () => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a1914]">
    <div className="relative w-72 h-32 flex flex-col items-center justify-end">
      <div className="w-full h-1 bg-white/20 rounded-full absolute bottom-12 overflow-hidden">
        <motion.div animate={{ x: ["-100%", "200%"] }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="w-1/2 h-full bg-emerald-400" />
      </div>
      <div className="flex space-x-1 mt-auto text-emerald-400 font-extrabold tracking-widest text-sm">
        {"NOW LOADING".split("").map((char, index) => (
          <motion.span key={index} animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1, delay: index * 0.05 }}>{char === " " ? "\u00A0" : char}</motion.span>
        ))}
      </div>
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
type DayData = { meals: string[]; shopping: ShoppingItem[] };

const DetailContent = ({ dateKey, displayDate, familyId, onClose, isMobile = false }: { dateKey: string; displayDate: string; familyId: string; onClose: () => void; isMobile?: boolean }) => {
  const [data, setData] = useState<DayData>({ meals: [], shopping: [] });
  const [newMeal, setNewMeal] = useState("");
  const [newShopping, setNewShopping] = useState("");

  useEffect(() => {
    if (!familyId || !dateKey) return;
    const unsubscribe = onSnapshot(doc(db, "users", familyId, "calendar", dateKey), (docSnap) => {
      setData(docSnap.exists() ? docSnap.data() as DayData : { meals: [], shopping: [] });
    });
    return () => unsubscribe();
  }, [familyId, dateKey]);

  const saveToFirestore = async (newData: DayData) => {
    if (familyId && dateKey) await setDoc(doc(db, "users", familyId, "calendar", dateKey), newData, { merge: true });
  };

  const handleAddMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeal.trim()) return;
    saveToFirestore({ ...data, meals: [...data.meals, newMeal.trim()] });
    setNewMeal("");
  };

  const handleAddShopping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopping.trim()) return;
    saveToFirestore({ ...data, shopping: [...data.shopping, { id: Date.now().toString(), text: newShopping.trim(), checked: false }] });
    setNewShopping("");
  };

  const toggleShoppingCheck = (id: string) => {
    saveToFirestore({ ...data, shopping: data.shopping.map(item => item.id === id ? { ...item, checked: !item.checked } : item) });
  };

  const handleDeleteMeal = (indexToRemove: number) => {
    const updatedMeals = data.meals.filter((_, index) => index !== indexToRemove);
    saveToFirestore({ ...data, meals: updatedMeals });
  };

  const handleDeleteShopping = (idToRemove: string) => {
    const updatedShopping = data.shopping.filter(item => item.id !== idToRemove);
    saveToFirestore({ ...data, shopping: updatedShopping });
  };

  return (
    <div className="h-full flex flex-col text-white">
      {isMobile ? (
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
          <h3 className="font-extrabold text-lg mt-2">{displayDate}</h3>
          <button onClick={onClose} className="p-2 mt-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><X className="w-5 h-5" /></button>
        </div>
      ) : (
        <div className="mb-6">
          <h3 className="text-2xl font-extrabold drop-shadow-md">{displayDate}</h3>
        </div>
      )}

      <div className={clsx("flex-1 overflow-y-auto space-y-8 pb-20", isMobile ? "p-4" : "")}>
        <section>
          <div className="flex items-center space-x-2 mb-3 text-emerald-400">
            <Utensils className="w-5 h-5" />
            <h4 className="font-bold">献立</h4>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {data.meals.map((meal, index) => (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} key={index} 
                  className="flex items-center justify-between p-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl shadow-lg group transition-colors hover:bg-white/15"
                >
                  <span className="text-sm font-bold truncate pr-4">{meal}</span>
                  <button onClick={() => handleDeleteMeal(index)} className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all shrink-0 md:opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            <form onSubmit={handleAddMeal} className="relative group">
              <input type="text" value={newMeal} onChange={(e) => setNewMeal(e.target.value)} placeholder="献立を追加..." className="w-full pl-4 pr-10 py-3 bg-black/20 border border-white/10 border-dashed rounded-xl text-sm font-medium focus:bg-black/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all placeholder:text-white/40 text-white" />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/40 hover:text-emerald-400 hover:bg-white/10 rounded-lg"><Plus className="w-4 h-4" /></button>
            </form>
          </div>
        </section>

        <section>
          <div className="flex items-center space-x-2 mb-3 text-emerald-400">
            <ShoppingCart className="w-5 h-5" />
            <h4 className="font-bold">買うもの</h4>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {data.shopping.map((item, index) => {
                const cat = getCategoryInfo(item.category || detectCategory(item.text));
                return (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={item.id ? `shop-${item.id}` : `shop-${index}`}
                    onClick={() => toggleShoppingCheck(item.id)}
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border shadow-lg backdrop-blur-md group",
                      item.checked
                        ? "bg-black/30 border-transparent opacity-50"
                        : "bg-white/10 border-white/10 hover:border-emerald-400/50 hover:bg-white/20"
                    )}
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden flex-1">
                      {item.checked ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-white/30 shrink-0" />
                      )}
                      <span className="text-xs shrink-0" title={cat.name}>
                        {cat.emoji}
                      </span>
                      <span
                        className={clsx(
                          "text-sm font-bold transition-all truncate",
                          item.checked
                            ? "text-white/40 line-through font-medium"
                            : "text-white"
                        )}
                      >
                        {item.text}
                      </span>
                      {(item.quantity || 1) > 1 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-300 text-xs font-bold shrink-0">
                          ×{item.quantity}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteShopping(item.id);
                      }}
                      className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all shrink-0 ml-2 md:opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <form onSubmit={handleAddShopping} className="relative group">
              <input type="text" value={newShopping} onChange={(e) => setNewShopping(e.target.value)} placeholder="買うものを追加..." className="w-full pl-4 pr-10 py-3 bg-black/20 border border-white/10 border-dashed rounded-xl text-sm font-medium focus:bg-black/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 outline-none transition-all placeholder:text-white/40 text-white" />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/40 hover:text-emerald-400 hover:bg-white/10 rounded-lg"><Plus className="w-4 h-4" /></button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

const CalendarCell = ({ day, year, month, familyId, isSelected, onClick }: { day: number; year: number; month: number; familyId: string; isSelected: boolean; onClick: () => void }) => {
  const [data, setData] = useState<DayData | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  useEffect(() => {
    if (!familyId || !day) return;
    const unsubscribe = onSnapshot(doc(db, "users", familyId, "calendar", dateKey), (docSnap) => { setData(docSnap.exists() ? docSnap.data() as DayData : null); });
    return () => unsubscribe();
  }, [familyId, year, month, day]);

  const handleDragStart = (e: React.DragEvent, type: "meal" | "shopping", item: any) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ sourceDateKey: dateKey, type, item }));
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
        const itemToAdd = isCopy ? { ...item, id: Date.now().toString() + Math.random().toString(36).substring(2, 5) } : item;
        await setDoc(targetRef, { shopping: arrayUnion(itemToAdd) }, { merge: true });
      }
    } catch (error) { console.error("D&D Error:", error); }
  };

  const firstMeal = data?.meals?.[0];
  const firstShopping = data?.shopping?.filter(item => !item.checked)?.[0];

  return (
    <div
      onClick={onClick}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey) ? "copy" : "move"; }}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={clsx(
        "w-full h-full p-1.5 lg:p-2.5 rounded-xl lg:rounded-2xl border transition-all text-left flex flex-col backdrop-blur-md overflow-hidden cursor-pointer", 
        isSelected ? "bg-emerald-500/40 border-emerald-400 shadow-lg ring-1 ring-emerald-400 scale-[1.02]" : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 hover:shadow-lg",
        isDragOver && "ring-2 ring-emerald-300 bg-emerald-500/20"
      )}
    >
      <span className="text-sm lg:text-lg font-bold drop-shadow-md mb-1.5 text-white pointer-events-none">{day}</span>
      <div className="flex flex-col gap-1 w-full flex-1 overflow-hidden">
        {firstMeal && (
          <div draggable onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, "meal", firstMeal); }} className="cursor-grab active:cursor-grabbing w-full text-[10px] lg:text-xs font-bold px-1.5 py-1 rounded bg-emerald-500/30 text-emerald-50 border border-emerald-400/20 truncate shadow-sm flex items-center hover:bg-emerald-500/50 transition-colors">
            <Utensils className="w-3 h-3 shrink-0 mr-1 opacity-80" />
            <span className="truncate pointer-events-none">{firstMeal}</span>
          </div>
        )}
        {firstShopping && (
          <div draggable onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, "shopping", firstShopping); }} className="cursor-grab active:cursor-grabbing w-full text-[10px] lg:text-xs font-bold px-1.5 py-1 rounded bg-cyan-500/30 text-cyan-50 border border-cyan-400/20 truncate shadow-sm flex items-center hover:bg-cyan-500/50 transition-colors">
            <ShoppingCart className="w-3 h-3 shrink-0 mr-1 opacity-80" />
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
  enter: (direction: number) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -300 : 300, opacity: 0 })
};

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate()); 
  const [direction, setDirection] = useState(0); 

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) { 
        try {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          if (isMounted) {
            const currentFamilyId = userSnap.exists() && userSnap.data()?.familyId ? userSnap.data().familyId : user.uid;
            setFamilyId(currentFamilyId);
          }
        } catch (err) {
          console.warn("ユーザー情報の取得でエラー（UIDを使用します）:", err);
          if (isMounted) {
            setFamilyId(user.uid);
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      } else {
        router.push("/login");
        if (isMounted) {
          setIsLoading(false);
        }
      }
    });

    // 通信が滞った場合でも2秒後に強制解除する安全タイマー
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 2000);

    return () => {
      isMounted = false;
      unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [router]);

  const changeMonth = (offset: number) => { setDirection(offset); setSelectedDay(null); setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1)); };
  const handleDragEnd = (e: any, { offset }: any) => { if (offset.x > 50) changeMonth(-1); else if (offset.x < -50) changeMonth(1); };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const calendarDays = getCalendarData(currentYear, currentMonth);
  const selectedDateKey = selectedDay ? `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}` : "";
  const displayDateStr = selectedDay ? `${currentMonth}月${selectedDay}日` : "";

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="relative min-h-screen overflow-hidden text-white flex">
      {/* 🌟 案B改：Gentle Forest（目に優しい、柔らかく深いオーラ） */}
      <div className="fixed inset-0 -z-10 bg-[#07160e] overflow-hidden flex items-center justify-center">
        {/* 巨大な光のオーブ 1（柔らかいエメラルド） */}
        <motion.div
          animate={{
            x: ["-20vw", "15vw", "-20vw"],
            y: ["-15vh", "20vh", "-15vh"],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[80vw] h-[80vh] rounded-full bg-emerald-600/15 blur-[120px]"
        />
        {/* 巨大な光のオーブ 2（落ち着いたティール/青緑） */}
        <motion.div
          animate={{
            x: ["25vw", "-15vw", "25vw"],
            y: ["20vh", "-20vh", "20vh"],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[70vw] h-[70vh] rounded-full bg-teal-700/20 blur-[120px]"
        />
        {/* 巨大な光のオーブ 3（ほのかなライムの暖かみ） */}
        <motion.div
          animate={{
            x: ["0vw", "30vw", "-20vw", "0vw"],
            y: ["10vh", "-30vh", "15vh", "10vh"],
          }}
          transition={{ duration: 35, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[60vw] h-[60vh] rounded-full bg-lime-600/10 blur-[100px]"
        />
        {/* 全体の眩しさを抑え、文字を圧倒的に読みやすくするフィルター */}
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/60" />
      </div>

      <div className="relative z-10 flex items-start flex-1 min-h-screen">
        <div className="flex-1 min-w-0 p-3 lg:p-10 pb-20 lg:pb-8 flex flex-col h-full min-h-[calc(100dvh-calc(env(safe-area-inset-top,0px)+12px))] md:h-screen">
          <div className="flex items-center justify-between mb-4 lg:mb-8 pr-12 md:pr-0">
            <div className="flex items-center space-x-2 lg:space-x-4">
              <h2 className="text-xl lg:text-3xl font-extrabold text-white drop-shadow-md tracking-tight">
                {currentYear}年 {currentMonth}月
              </h2>
              <div className="flex space-x-1 ml-1 lg:ml-4">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  className="p-1.5 lg:p-2 bg-black/35 md:bg-white/10 backdrop-blur-md border border-white/15 rounded-xl hover:bg-white/20 shadow-sm transition-all active:scale-95"
                  aria-label="前月"
                >
                  <ChevronLeft className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  className="p-1.5 lg:p-2 bg-black/35 md:bg-white/10 backdrop-blur-md border border-white/15 rounded-xl hover:bg-white/20 shadow-sm transition-all active:scale-95"
                  aria-label="次月"
                >
                  <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 lg:gap-4 mb-2 lg:mb-4">
            {["日", "月", "火", "水", "木", "金", "土"].map((day, i) => (
              <div
                key={`weekday-${day}-${i}`}
                className={clsx(
                  "text-center text-xs lg:text-sm font-bold drop-shadow-md",
                  i === 0
                    ? "text-red-400"
                    : i === 6
                    ? "text-blue-400"
                    : "text-white/80"
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 🌟 修正ポイント：高さの自動圧縮＆スクロール機能を追加 */}
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
                className="absolute inset-0 overflow-y-auto overflow-x-hidden pb-24 lg:pb-6 grid grid-cols-7 gap-1 lg:gap-3 grid-rows-[repeat(6,minmax(65px,1fr))] lg:grid-rows-[repeat(6,minmax(100px,1fr))] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
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
          {/* 🌟 修正ポイントここまで */}
        </div>

        {/* ＝＝＝ 右側/下部の詳細パネル ＝＝＝ */}
        {selectedDay && familyId && (
          <>
            <div className="hidden lg:block sticky top-0 w-[380px] h-screen border-l border-white/10 bg-black/20 backdrop-blur-2xl shadow-[-20px_0_40px_rgba(0,0,0,0.3)] z-10 p-8">
              <DetailContent dateKey={selectedDateKey} displayDate={displayDateStr} familyId={familyId} onClose={() => setSelectedDay(null)} />
            </div>
            
            <AnimatePresence>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedDay(null)} className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="lg:hidden fixed inset-x-0 bottom-0 z-50 h-[75vh] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col border-t border-white/10 bg-black/40 backdrop-blur-2xl">
                <DetailContent dateKey={selectedDateKey} displayDate={displayDateStr} familyId={familyId} onClose={() => setSelectedDay(null)} isMobile={true} />
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}