import { useEffect, useState } from "react";

const KEY = "pn-avatars";
export const USER_ID = "__user__";

type AvatarMap = Record<string, string>;

function read(): AvatarMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function write(m: AvatarMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch (e) {
    // localStorage quota — keep going
    console.warn("avatar store full", e);
  }
  window.dispatchEvent(new Event("pn-avatars"));
}

export function getAvatar(id: string): string | undefined {
  return read()[id];
}

export function setAvatar(id: string, dataUrl: string) {
  const m = read();
  m[id] = dataUrl;
  write(m);
}

export function removeAvatar(id: string) {
  const m = read();
  delete m[id];
  write(m);
}

/** Live avatar value for an id, falling back to a default URL. */
export function useAvatar(id: string, fallback: string): string {
  const [v, setV] = useState(() => getAvatar(id) || fallback);
  useEffect(() => {
    const h = () => setV(getAvatar(id) || fallback);
    h();
    window.addEventListener("pn-avatars", h);
    return () => window.removeEventListener("pn-avatars", h);
  }, [id, fallback]);
  return v;
}
