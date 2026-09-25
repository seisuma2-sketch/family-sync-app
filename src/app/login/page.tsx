"use client";

import { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { Mail, Lock, LogIn, UserPlus, Leaf, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion"; // ★アニメーション用

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // ★処理中（待機画面）の判定
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const router = useRouter();

  // ＝＝＝ ログイン・新規登録処理 ＝＝＝
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    
    // ★ボタンを押した瞬間に待機画面へ切り替える（連打防止＆安心感）
    setIsProcessing(true); 

    try {
      if (isLogin) {
        // ログイン処理
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // 新規登録処理
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // データベースへの保存
        try {
          await setDoc(doc(db, "users", user.uid), {
            displayName: user.displayName || "名無しさん",
            email: user.email,
            currentGroupId: null,
          });
        } catch (dbErr) {
          console.warn("DBエラー:", dbErr);
        }
      }

      // ★【演出】通信が早く終わっても、あえて少し待機画面を見せて「処理してる感」を出す
      await new Promise((resolve) => setTimeout(resolve, 600));

      // ホーム画面へ確実に遷移
      window.location.href = "/";
      
    } catch (err: any) {
      // エラーが起きた場合は待機画面を解除してエラーを表示
      setIsProcessing(false); 
      
      if (err.code === 'auth/email-already-in-use') {
        setError("このメールアドレスは既に登録されています。");
      } else if (err.code === 'auth/weak-password') {
        setError("パスワードは6文字以上で入力してください。");
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError("メールアドレスかパスワードが間違っています。");
      } else {
        setError("認証に失敗しました。入力内容をご確認ください。");
      }
    }
  };

  // ＝＝＝ パスワード再設定処理 ＝＝＝
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!email) {
      setError("メールアドレスを入力してください。");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg("パスワード再設定用のメールを送信しました。受信トレイをご確認ください。");
      setIsForgotPassword(false); 
      setPassword(""); 
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError("このメールアドレスは登録されていません。");
      } else if (err.code === 'auth/invalid-email') {
        setError("正しいメールアドレスの形式で入力してください。");
      } else {
        setError("メールの送信に失敗しました。時間をおいて再度お試しください。");
      }
    }
  };

  // ＝＝＝ Googleログイン処理 ＝＝＝
  const handleGoogleLogin = async () => {
    setError("");
    setSuccessMsg("");
    setIsProcessing(true); // ★Googleログインボタンを押した時も待機画面にする

    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          await setDoc(userDocRef, {
            displayName: user.displayName,
            email: user.email,
            currentGroupId: null,
          });
        }
      } catch (dbErr) {
        console.warn("DBエラー:", dbErr);
      }
      
      // Googleログイン後、ホーム画面へ確実に遷移
      await new Promise((resolve) => setTimeout(resolve, 600));
      window.location.href = "/";
      
    } catch (err: any) {
      setIsProcessing(false); // ポップアップを閉じられた時などは待機画面を解除
      setError("Googleログインをキャンセル、または失敗しました。");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden fixed inset-0 z-50">
      <div className="absolute inset-0 z-0 bg-[#0a1914]">
        <img 
          src="https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=2000&auto=format&fit=crop" 
          alt="Forest background" 
          className="object-cover w-full h-full opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-emerald-950/20 to-transparent mix-blend-multiply" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-white/20">
        
        {/* ＝＝＝ ★新設：処理中の心地よい待機画面 ＝＝＝ */}
        {isProcessing ? (
          <div className="text-center animate-in fade-in zoom-in-95 duration-500 py-8">
            <motion.div 
              animate={{ y: [0, -10, 0] }} 
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-full mb-6 border border-emerald-400/30 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
            >
              <Leaf className="w-8 h-8 text-emerald-300" />
            </motion.div>
            <h3 className="text-2xl font-bold text-white mb-4">
              {isLogin ? "ログインしています..." : "アカウントを準備中..."}
            </h3>
            <p className="text-emerald-100 text-sm leading-relaxed mb-8">
              少々お待ちください。
            </p>
            
            {/* ポコポコ動くローディングの丸 */}
            <div className="flex justify-center space-x-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                  className="w-2 h-2 rounded-full bg-emerald-400"
                />
              ))}
            </div>
          </div>
        ) : isForgotPassword ? (
          /* ＝＝＝ パスワード忘れモード ＝＝＝ */
          <form onSubmit={handleResetPassword} className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/80 backdrop-blur-sm rounded-xl mb-6 border border-white/20 shadow-lg">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">Reset Password</h2>
              <p className="text-emerald-100 text-sm font-medium">パスワードの再設定</p>
            </div>
            {error && <div className="mb-6 p-4 bg-red-500/20 backdrop-blur-sm border border-red-500/50 text-red-100 text-sm rounded-xl font-medium">{error}</div>}
            {successMsg && <div className="mb-6 p-4 bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/50 text-emerald-50 text-sm rounded-xl font-medium">{successMsg}</div>}
            
            <p className="text-sm text-emerald-100 mb-4 leading-relaxed">
              ご登録のメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
            </p>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-emerald-50">メールアドレス</label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 group-focus-within:text-emerald-300 transition-colors" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:bg-black/40 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400 outline-none transition-all" placeholder="mail@example.com" />
              </div>
            </div>
            <button type="submit" className="w-full flex items-center justify-center space-x-2 bg-emerald-600/90 hover:bg-emerald-500 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg border border-white/10 backdrop-blur-sm transition-all active:scale-[0.98]">
              <Send className="w-4 h-4" />
              <span>再設定メールを送信</span>
            </button>
            <div className="mt-6 text-center">
              <button type="button" onClick={() => { setIsForgotPassword(false); setError(""); setSuccessMsg(""); }} className="text-sm text-emerald-300 hover:text-emerald-100 font-medium transition-colors">
                ← ログイン画面に戻る
              </button>
            </div>
          </form>
        ) : (
          /* ＝＝＝ 通常ログイン・新規登録モード ＝＝＝ */
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/80 backdrop-blur-sm rounded-xl mb-6 border border-white/20 shadow-lg">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
                {isLogin ? "Welcome back" : "Join us"}
              </h2>
              <p className="text-emerald-100 text-sm font-medium">
                Family Syncで、心地よい毎日を。
              </p>
            </div>
            
            {error && <div className="mb-6 p-4 bg-red-500/20 backdrop-blur-sm border border-red-500/50 text-red-100 text-sm rounded-xl font-medium">{error}</div>}
            
            <form onSubmit={handleEmailAuth} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-emerald-50">メールアドレス</label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 group-focus-within:text-emerald-300 transition-colors" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:bg-black/40 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400 outline-none transition-all" placeholder="mail@example.com" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-end">
                  <label className="block text-sm font-semibold text-emerald-50">パスワード</label>
                  {isLogin && (
                    <button type="button" onClick={() => { setIsForgotPassword(true); setError(""); setSuccessMsg(""); }} className="text-xs text-emerald-300 hover:text-white transition-colors">
                      パスワードを忘れた場合
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 group-focus-within:text-emerald-300 transition-colors" />
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:bg-black/40 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400 outline-none transition-all" placeholder="6文字以上の英数字" minLength={6} />
                </div>
              </div>

              <button type="submit" className="w-full flex items-center justify-center space-x-2 bg-emerald-600/90 hover:bg-emerald-500 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg border border-white/10 backdrop-blur-sm transition-all active:scale-[0.98]">
                {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                <span>{isLogin ? "ログイン" : "アカウントを作成"}</span>
              </button>
            </form>

            <div className="mt-8 mb-6 flex items-center">
              <div className="grow border-t border-white/10"></div>
              <span className="shrink-0 mx-4 text-white/40 text-xs font-bold uppercase tracking-wider">or</span>
              <div className="grow border-t border-white/10"></div>
            </div>

            <button onClick={handleGoogleLogin} type="button" className="w-full flex items-center justify-center space-x-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-sm py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span>Googleでログイン</span>
            </button>

            <div className="mt-8 text-center">
              <button onClick={() => { setIsLogin(!isLogin); setError(""); setSuccessMsg(""); }} className="text-sm text-emerald-300 hover:text-emerald-100 font-medium transition-colors">
                {isLogin ? "アカウントをお持ちでないですか？ 新規登録" : "すでにアカウントをお持ちですか？ ログイン"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}