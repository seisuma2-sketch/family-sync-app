/**
 * モバイル端末向けの触感フィードバック（ハプティクス / 微振動）ユーティリティ
 * Web Vibration API (navigator.vibrate) をサポートしている端末で動作します。
 */

export type HapticType = "light" | "medium" | "heavy" | "success" | "warning";

export function triggerHaptic(type: HapticType = "light") {
  if (typeof window === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  try {
    switch (type) {
      case "light":
        // 軽いタップ・選択時（10ミリ秒）
        navigator.vibrate(10);
        break;
      case "medium":
        // チェックボックス・ボタン押下時（25ミリ秒）
        navigator.vibrate(25);
        break;
      case "heavy":
        // 削除などの重要アクション（40ミリ秒）
        navigator.vibrate(40);
        break;
      case "success":
        // 買い物完了・全達成時の心地よいリズム（タ・タン）
        navigator.vibrate([15, 60, 25]);
        break;
      case "warning":
        // 注意・確認時
        navigator.vibrate([30, 50, 30]);
        break;
      default:
        navigator.vibrate(10);
    }
  } catch {
    // 振動非対応ブラウザや権限エラーは無視
  }
}
