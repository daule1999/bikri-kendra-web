// hooks/useDeviceType.ts
import { useEffect, useState } from "react";

type DeviceType = "mobile" | "desktop";

const MOBILE_BREAKPOINT = 768;

export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === "undefined") return "desktop";
    return window.innerWidth < MOBILE_BREAKPOINT ? "mobile" : "desktop";
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(max-width: ${MOBILE_BREAKPOINT - 1}px)`,
    );

    const handleChange = (e: MediaQueryListEvent) => {
      setDeviceType(e.matches ? "mobile" : "desktop");
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return deviceType;
}
