"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function Sprout({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 22V11" stroke="#1F7A51" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M12 12C12 7 8 4 3 4c0 5 3 8 9 8z" fill="#2E9E6B" />
      <path d="M12 15c0-4 3-7 9-7 0 5-3 8-9 7z" fill="#7CCB9A" />
    </svg>
  );
}

const TABS = [
  { href: "/", label: "홈", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/sessions", label: "회기", icon: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" },
  { href: "/homework", label: "숙제", icon: "M4 6l2 2 3-3M4 13l2 2 3-3M12 7h8M12 14h8M4 20h16" },
  { href: "/settings", label: "설정", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-1-1-2H10L9 5 7 6 5 5 3 9l2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1z" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="주요 메뉴">
      <ul>
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={t.icon} />
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function useToast(): [React.ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return [msg ? <div className="toast" role="status">{msg}</div> : null, show];
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function BackLink({ href, label = "뒤로" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      {label}
    </Link>
  );
}

// API 오류 본문에서 보호자에게 보일 문구를 꺼낸다
export async function errorMessage(res: Response, fallback = "잠시 후 다시 시도해 주세요."): Promise<{ message: string; code?: string; fieldErrors?: Record<string, string> }> {
  const body = await res.json().catch(() => null);
  return { message: body?.error?.message ?? fallback, code: body?.error?.code, fieldErrors: body?.error?.fieldErrors };
}
