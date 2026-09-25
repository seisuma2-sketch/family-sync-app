"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Clock, PlusCircle, CheckCircle2, Utensils } from "lucide-react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { triggerHaptic } from "@/lib/haptics";

type HistoryMeal = { name: string; lastUsed: string; count: number };

export default function HistoryPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [meals, setMeals] = useState<HistoryMeal[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const currentFamilyId =
          userSnap.exists() && userSnap.data().familyId
            ? userSnap.data().familyId
            : user.uid;
        setFamilyId(currentFamilyId);

        await fetchHistory(currentFamilyId);
        setIsLoading(false);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchHistory = async (fId: string) => {
    try {
      const calRef = collection(db, "users", fId, "calendar");
      const snapshot = await getDocs(calRef);
      const mealMap = new Map<string, HistoryMeal>();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const dateKey = docSnap.id;
        if (data.meals && Array.isArray(data.meals)) {
          data.meals.forEach((mealName: string) => {
            if (mealMap.has(mealName)) {
              const existing = mealMap.get(mealName)!;
              existing.count += 1;
              if (dateKey > existing.lastUsed) existing.lastUsed = dateKey;
            } else {
              mealMap.set(mealName, { name: mealName, lastUsed: dateKey, count: 1 });
            }
          });
        }
      });
      const sortedMeals = Array.from(mealMap.values()).sort((a, b) =>
        b.lastUsed.localeCompare(a.lastUsed)
      );
      setMeals(sortedMeals);
    } catch (error) {
      console.error("履歴の取得に失敗しました", error);
    }
  };

  const handleAddToToday = async (mealName: string) => {
    if (!familyId) return;
    triggerHaptic("medium");
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;
    const docRef = doc(db, "users", familyId, "calendar", todayKey);

    try {
      const docSnap = await getDoc(docRef);
      let currentMeals: string[] = [];
      if (docSnap.exists() && docSnap.data().meals) {
        currentMeals = docSnap.data().meals;
      }
      if (!currentMeals.includes(mealName)) {
        await setDoc(docRef, { meals: [...currentMeals, mealName] }, { merge: true });
        setToastMsg(`「${mealName}」を今日の献立に追加しました！`);
        setTimeout(() => setToastMsg(""), 3000);
      } else {
        setToastMsg(`「${mealName}」は既に今日の献立にあります。`);
        setTimeout(() => setToastMsg(""), 3000);
      }
    } catch (error) {
      console.error("追加エラー", error);
    }
  };

  const filteredMeals = meals.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-emerald-400 font-bold">
        Loading...
      </div>
    );

  return (
    <div className="relative min-h-screen overflow-hidden text-white flex">
      <div className="fixed inset-0 -z-10 bg-black">
        <img
          src="/sizen.jpg"
          alt="Natural background"
          className="object-cover w-full h-full opacity-80"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 min-h-screen p-4 lg:p-10 pb-28 lg:pb-12 max-w-5xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 pr-12 md:pr-0">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
              <Clock className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl lg:text-3xl font-extrabold text-white drop-shadow-md tracking-tight">
                献立履歴
              </h2>
              <p className="text-white/60 text-xs sm:text-sm font-medium mt-0.5">
                過去に作ったメニューから今日のご飯を決める
              </p>
            </div>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="献立を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black/35 backdrop-blur-md border border-white/10 rounded-xl text-sm font-medium focus:bg-black/50 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none transition-all placeholder:text-white/30 text-white shadow-lg"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {filteredMeals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-white/40 space-y-4 bg-white/5 backdrop-blur-md rounded-3xl border border-white/5">
              <Utensils className="w-12 h-12 opacity-50" />
              <p className="font-medium text-base">履歴が見つかりません</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              <AnimatePresence>
                {filteredMeals.map((meal, index) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.3) }}
                    key={meal.name}
                    className="flex items-center justify-between p-3.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-lg hover:bg-white/15 transition-all group active:scale-[0.99]"
                  >
                    <div className="flex flex-col overflow-hidden mr-3">
                      <span className="font-bold text-base text-white truncate">
                        {meal.name}
                      </span>
                      <span className="text-xs text-white/50 mt-1 font-medium flex items-center gap-2">
                        <span>直近: {meal.lastUsed}</span>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span>{meal.count}回作りました</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddToToday(meal.name)}
                      className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all active:scale-95"
                      title="今日の献立に追加"
                    >
                      <PlusCircle className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-2 px-5 py-3 bg-emerald-500 text-white rounded-full shadow-[0_10px_40px_rgba(16,185,129,0.4)] font-bold text-sm pointer-events-none"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}