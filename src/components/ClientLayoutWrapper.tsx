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
      {/* ログイン画面「以外」のときだけ、ナビゲーションを表示する */}
      {!isLogin && <Navigation />}

      {/* ログイン画面以外はiOSセーフエリア上部・下部のパディングを確保 */}
      <main
        className={
          isLogin
            ? "min-h-screen"
            : "pt-[calc(env(safe-area-inset-top,0px)+12px)] md:pt-0 pb-20 md:pb-0 md:pl-64 min-h-screen"
        }
      >
        {children}
      </main>
    </>
  );
}