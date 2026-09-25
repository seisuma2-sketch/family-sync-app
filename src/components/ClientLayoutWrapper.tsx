"use client";

import { usePathname } from "next/navigation";
import Navigation from "./Navigation";

export default function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <>
      {/* ログイン画面「以外」のときだけ、サイドバーを表示する */}
      {!isLogin && <Navigation />}

      {/* ログイン画面のときは余白をゼロにして全画面表示にする */}
      <main className={isLogin ? "min-h-screen" : "pb-16 md:pb-0 md:pl-64 min-h-screen"}>
        {children}
      </main>
    </>
  );
}