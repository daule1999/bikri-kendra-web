// hooks/useIsMobile.ts
import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false; // SSR-safe
    return window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);

    // ✅ Only subscribe — no synchronous setState here
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);

    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}
