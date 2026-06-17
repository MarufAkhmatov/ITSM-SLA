import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Check, X, ZoomIn } from "lucide-react";
import { useI18n } from "../i18n";

const V = 300;     // viewport size
const OUT = 256;   // output size

export function AvatarCropModal({
  src, title, onSave, onCancel,
}: { src: string; title: string; onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [minScale, setMinScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const ms = V / Math.min(img.naturalWidth, img.naturalHeight);
      setNat({ w: img.naturalWidth, h: img.naturalHeight });
      setMinScale(ms);
      setScale(ms);
      setPos({ x: (V - img.naturalWidth * ms) / 2, y: (V - img.naturalHeight * ms) / 2 });
    };
    img.src = src;
  }, [src]);

  const clamp = useCallback((p: { x: number; y: number }, s: number) => {
    const w = nat.w * s, h = nat.h * s;
    let { x, y } = p;
    x = Math.min(0, Math.max(V - w, x));
    y = Math.min(0, Math.max(V - h, y));
    return { x, y };
  }, [nat]);

  const onZoom = (s2: number) => {
    // keep viewport center fixed
    const srcX = (V / 2 - pos.x) / scale;
    const srcY = (V / 2 - pos.y) / scale;
    const np = { x: V / 2 - srcX * s2, y: V / 2 - srcY * s2 };
    setScale(s2);
    setPos(clamp(np, s2));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setPos(clamp({ x: drag.current.px + dx, y: drag.current.py + dy }, scale));
  };
  const onPointerUp = () => { drag.current = null; };

  const save = () => {
    const img = imgRef.current;
    if (!img) return;
    const sSize = V / scale;
    const sx = -pos.x / scale;
    const sy = -pos.y / scale;
    const c = document.createElement("canvas");
    c.width = OUT; c.height = OUT;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUT, OUT);
    onSave(c.toDataURL("image/jpeg", 0.85));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.62)", backdropFilter: "blur(4px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 14 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 18, padding: 22, boxShadow: "0 30px 80px rgba(0,0,0,0.4)", width: 360, maxWidth: "94vw" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text)" }}>{title}</span>
          <button onClick={onCancel} style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} color="#6b7a8d" />
          </button>
        </div>

        {/* crop viewport */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ width: V, height: V, maxWidth: "100%", position: "relative", overflow: "hidden", borderRadius: 12, background: "#0e151f", cursor: "grab", touchAction: "none", margin: "0 auto" }}
        >
          {imgRef.current && (
            <img
              src={src}
              alt="crop"
              draggable={false}
              style={{ position: "absolute", left: pos.x, top: pos.y, width: nat.w * scale, height: nat.h * scale, userSelect: "none", pointerEvents: "none" }}
            />
          )}
          {/* round guide */}
          <div style={{ position: "absolute", inset: 0, boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)", borderRadius: "50%", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(255,255,255,0.7)", borderRadius: "50%", pointerEvents: "none" }} />
        </div>

        {/* zoom */}
        <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
          <ZoomIn size={15} color="#6b7a8d" />
          <input
            type="range" min={minScale} max={minScale * 4} step={0.001} value={scale}
            onChange={(e) => onZoom(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: "#2d7a5f" }}
          />
        </div>

        <div className="flex items-center justify-end gap-2" style={{ marginTop: 16 }}>
          <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: 10, background: "var(--surface2)", border: "none", cursor: "pointer", fontSize: "0.8rem", color: "var(--text)", fontFamily: "var(--font-sans)" }}>{t("crop_cancel")}</button>
          <button onClick={save} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 10, background: "linear-gradient(135deg,#2d7a5f,#4EB6A6)", border: "none", cursor: "pointer", fontSize: "0.8rem", color: "#fff", fontWeight: 600, fontFamily: "var(--font-sans)" }}>
            <Check size={14} /> {t("crop_save")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
