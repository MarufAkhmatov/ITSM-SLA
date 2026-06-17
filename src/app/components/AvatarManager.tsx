import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Camera, Trash2, UserCog } from "lucide-react";
import { usePortfolio } from "../portfolio";
import { useI18n } from "../i18n";
import { getAvatar, setAvatar, removeAvatar, USER_ID, useAvatar } from "../avatars";
import { AvatarCropModal } from "./AvatarCropModal";

function pmFallback(name: string) {
  return `https://i.pravatar.cc/96?u=${encodeURIComponent(name)}`;
}
const userFallback = "https://ui-avatars.com/api/?name=Temur&background=8a5a2b&color=fff&bold=true";

function Row({ id, name, fallback, onPick }: { id: string; name: string; fallback: string; onPick: (id: string) => void }) {
  const { t } = useI18n();
  const url = useAvatar(id, fallback);
  const has = !!getAvatar(id);
  return (
    <div className="flex items-center gap-3" style={{ padding: "8px 4px" }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <img src={url} alt={name} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--divider)" }} />
      </div>
      <span style={{ flex: 1, fontSize: "0.82rem", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
      {has && (
        <button onClick={() => removeAvatar(id)} title={t("av_reset")} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trash2 size={13} color="#e07a7a" />
        </button>
      )}
      <button onClick={() => onPick(id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", fontSize: "0.72rem", color: "var(--text)", fontFamily: "var(--font-sans)" }}>
        <Camera size={13} /> {t("av_change")}
      </button>
    </div>
  );
}

export function AvatarManager({ onClose }: { onClose: () => void }) {
  const { pmBoard } = usePortfolio();
  const { t, tf } = useI18n();
  const [pms, setPms] = useState<string[]>([]);
  const [cropFor, setCropFor] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pmBoard("all").then((r) => setPms((r?.rows || []).map((x: any) => x.pm)));
  }, [pmBoard]);

  const pick = useCallback((id: string) => {
    setCropFor(id);
    fileRef.current?.click();
  }, []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setCropSrc(URL.createObjectURL(f));
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,0.5)", backdropFilter: "blur(4px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}
    >
      <motion.div
        initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--card)", borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,0.35)", width: 460, maxWidth: "94vw", height: "min(78vh, 680px)", padding: 24, display: "flex", flexDirection: "column" }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <div className="flex items-center gap-2">
            <UserCog size={18} color="#2d7a5f" />
            <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>{t("av_title")}</span>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="#6b7a8d" />
          </button>
        </div>

        <div className="pn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 6 }}>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, margin: "6px 0 2px" }}>{t("av_you")}</div>
          <Row id={USER_ID} name={t("av_your_avatar")} fallback={userFallback} onPick={pick} />

          <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, margin: "14px 0 2px" }}>{t("healthcare_providers")} ({pms.length})</div>
          {pms.map((pm) => (
            <Row key={pm} id={pm} name={pm} fallback={pmFallback(pm)} onPick={pick} />
          ))}
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
      </motion.div>

      <AnimatePresence>
        {cropSrc && cropFor && (
          <AvatarCropModal
            src={cropSrc}
            title={cropFor === USER_ID ? t("av_crop_your") : tf("av_crop_named", { name: cropFor })}
            onCancel={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null); setCropFor(null); }}
            onSave={(dataUrl) => {
              setAvatar(cropFor, dataUrl);
              URL.revokeObjectURL(cropSrc);
              setCropSrc(null); setCropFor(null);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
