import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "말자람 노트",
  description: "치료 상담은 녹음만, 정리는 AI가. 회기 요약과 집에서 할 숙제를 한곳에.",
  manifest: "/manifest.json",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "말자람 노트", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#FFFBF2", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
