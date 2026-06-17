import { useState, useEffect } from "react";

export type BP = "mobile" | "tablet" | "desktop";

function get(): BP {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

export function useBreakpoint(): BP {
  const [bp, setBp] = useState<BP>(get());
  useEffect(() => {
    // Resync once after mount in case the initial useState ran before the
    // viewport settled (Vite iframe re-mounts, AuthGate render swap, mobile
    // Safari address-bar collapse, etc.) — otherwise mobile users get the
    // desktop layout until they manually resize.
    setBp(get());
    const onResize = () => setBp(get());
    window.addEventListener("resize", onResize);
    // Orientation change on real phones fires this BEFORE resize.
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return bp;
}
