// FNC-A-019: 알림 권한 요청 → 서비스 워커 구독 → 서버 저장
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type RegisterResult = "ok" | "unsupported" | "ios-not-installed" | "denied" | "error";

export class PushRegistrar {
  static isIos(): boolean {
    return /iPhone|iPad|iPod/.test(navigator.userAgent);
  }

  // iOS는 홈 화면에 추가한 PWA에서만 Web Push를 쓸 수 있다
  static isStandalone(): boolean {
    return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  }

  async register(): Promise<RegisterResult> {
    if (PushRegistrar.isIos() && !PushRegistrar.isStandalone()) return "ios-not-installed";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        }));
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      return res.ok ? "ok" : "error";
    } catch {
      return "error";
    }
  }
}
