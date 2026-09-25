"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, CheckCircle2, Circle, Calendar as CalendarIcon, ArrowDownCircle, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, doc, setDoc, getDoc } from "firebase/firestore"; // ★getDocを追加
import { auth, db } from "@/lib/firebase";

type ShoppingItemWithDate = { id: string; text: string; checked: boolean; dateKey: string; };
type DayData = { meals?: string[]; shopping?: { id: string; text: string; checked: boolean }[] };

export default function ShoppingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null); // ★userIdから変更
  const [dayDataMap, setDayDataMap] = useState<Record<string, DayData>>({});
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // ★ 家族IDを取得
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const currentFamilyId = userSnap.exists() && userSnap.data().familyId ? userSnap.data().familyId : user.uid;
        setFamilyId(currentFamilyId);

        // ★ 個人用ではなく家族用のカレンダーを監視
        const calRef = collection(db, "users", currentFamilyId, "calendar");
        const unsubscribeDb = onSnapshot(calRef, (snapshot) => {
          const newMap: Record<string, DayData> = {};
          snapshot.forEach(docSnap => { newMap[docSnap.id] = docSnap.data() as DayData; });
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
        data.shopping.forEach(item => { items.push({ ...item, dateKey }); });
      }
    });
    return items.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [dayDataMap]);

  const pendingItems = allShoppingItems.filter(item => !item.checked);
  const completedItems = allShoppingItems.filter(item => item.checked);

  const toggleCheck = async (dateKey: string, itemId: string) => {
    if (!familyId) return;
    const dayData = dayDataMap[dateKey];
    if (!dayData || !dayData.shopping) return;
    const updatedShopping = dayData.shopping.map(item => 
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    await setDoc(doc(db, "users", familyId, "calendar", dateKey), { shopping: updatedShopping }, { merge: true });
  };

  const handleDelete = async (dateKey: string, itemId: string) => {
    if (!familyId) return;
    const dayData = dayDataMap[dateKey];
    if (!dayData || !dayData.shopping) return;
    const updatedShopping = dayData.shopping.filter(item => item.id !== itemId);
    await setDoc(doc(db, "users", familyId, "calendar", dateKey), { shopping: updatedShopping }, { merge: true });
  };

  const formatDate = (dateStr: string) => {
    const [_, m, d] = dateStr.split("-");
    return `${parseInt(m)}/${parseInt(d)}`;
  };

  if (isLoading) return <div className="min-h-screen bg-[#0a1914] flex items-center justify-center text-emerald-400">Loading...</div>;

  return (
    <div className="relative min-h-screen overflow-hidden text-white flex">
      <div className="fixed inset-0 -z-10 bg-black">
        <img src="/sizen.jpg" alt="Natural background" className="object-cover w-full h-full opacity-80" />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 min-h-screen p-4 lg:p-10 pb-24 lg:pb-8 md:ml-64">
        <div className="flex items-center space-x-3 mb-8">
          <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
            <ShoppingCart className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white drop-shadow-md tracking-tight">まとめ買いリスト</h2>
            <p className="text-white/60 text-sm font-medium mt-1">カレンダーの全予定から自動集約</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 max-w-2xl w-full mx-auto">
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-lg font-bold text-emerald-400 drop-shadow-sm">買うもの ({pendingItems.length})</h3>
            </div>
            
            {pendingItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-white/40 bg-white/5 backdrop-blur-md rounded-3xl border border-white/5">
                <CheckCircle2 className="w-12 h-12 opacity-50 mb-4 text-emerald-500" />
                <p className="font-medium text-lg">買うものはすべて揃っています！</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {pendingItems.map((item) => (
                    <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, x: -20 }} transition={{ duration: 0.2 }} onClick={() => toggleCheck(item.dateKey, item.id)} className="flex items-center justify-between p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-lg hover:bg-white/20 hover:border-emerald-400/50 cursor-pointer transition-colors group">
                      <div className="flex items-center space-x-4 overflow-hidden flex-1">
                        <Circle className="w-6 h-6 text-white/30 shrink-0 group-hover:text-emerald-400 transition-colors" />
                        <span className="text-lg font-bold text-white truncate">{item.text}</span>
                      </div>
                      <div className="flex items-center space-x-3 shrink-0 ml-4">
                        <div className="flex items-center space-x-1 px-2.5 py-1 bg-white/10 rounded-lg">
                          <CalendarIcon className="w-3 h-3 text-white/60" />
                          <span className="text-xs font-bold text-white/60">{formatDate(item.dateKey)}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(item.dateKey, item.id); }} className="p-2 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all md:opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {completedItems.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-4 px-2 text-white/50">
                <ArrowDownCircle className="w-5 h-5" />
                <h3 className="text-sm font-bold">カゴに入れたもの ({completedItems.length})</h3>
              </div>
              <div className="space-y-2 opacity-70">
                <AnimatePresence>
                  {completedItems.map((item) => (
                    <motion.div key={item.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, scale: 0.9 }} onClick={() => toggleCheck(item.dateKey, item.id)} className="flex items-center justify-between p-3 bg-black/30 backdrop-blur-md border border-transparent rounded-xl cursor-pointer hover:bg-white/10 transition-colors group">
                      <div className="flex items-center space-x-3 overflow-hidden flex-1">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        <span className="text-sm font-medium text-white/50 line-through truncate">{item.text}</span>
                        <span className="text-[10px] font-bold text-white/30 shrink-0 ml-2">{formatDate(item.dateKey)}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(item.dateKey, item.id); }} className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all shrink-0 ml-2 md:opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}