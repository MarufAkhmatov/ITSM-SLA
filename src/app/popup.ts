import { useEffect, useSyncExternalStore } from "react";

/**
 * Tiny global "is any popup/modal open" tracker + Temur dock state.
 *
 * Why: when a popup opens we want the Temur (AI) panel to float on top of the
 * backdrop on the right side, so the user can keep asking Temur to drive the
 * dashboard instead of the panel getting buried behind the overlay. The user
 * can also MINIMIZE that floating dock (so it doesn't block a wide popup like
 * the Kanban board); while minimized, modals stop reserving room for it.
 */

let count = 0;
let minimized = false;
let pageCtx: { title: string; text: string } | null = null;   // data of the currently-open popup, for scoped Temur answers
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function incrPopup() {
  count += 1;
  emit();
}

export function decrPopup() {
  count = Math.max(0, count - 1);
  if (count === 0) { minimized = false; pageCtx = null; }   // reset when all popups close
  emit();
}

/** A popup publishes its on-screen data so Temur can answer "from this page". */
export function setPageContext(c: { title: string; text: string } | null) {
  pageCtx = c;
  emit();
}
function snapCtx() {
  return pageCtx;
}
/** Reactive: the currently-open popup's data context (or null). */
export function usePageContext() {
  return useSyncExternalStore(subscribe, snapCtx, snapCtx);
}
/** Set the page context while `open` is true; cleared on unmount. */
export function usePageContextSignal(open: boolean, build: () => { title: string; text: string } | null, deps: any[] = []) {
  useEffect(() => {
    if (!open) return;
    setPageContext(build());
    return () => setPageContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ...deps]);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function snapOpen() {
  return count > 0;
}
function snapMin() {
  return minimized;
}

/** Reactive: true while at least one popup is open. */
export function usePopupOpen(): boolean {
  return useSyncExternalStore(subscribe, snapOpen, snapOpen);
}

/** Reactive: true while the floating Temur dock is minimized. */
export function useTemurMinimized(): boolean {
  return useSyncExternalStore(subscribe, snapMin, snapMin);
}

/** Collapse / restore the floating Temur dock. */
export function setTemurMinimized(v: boolean) {
  minimized = v;
  emit();
}

/** Register a modal as open while `open` is true (auto-cleans on unmount). */
export function usePopupOpenSignal(open: boolean) {
  useEffect(() => {
    if (!open) return;
    incrPopup();
    return () => decrPopup();
  }, [open]);
}

/** Horizontal room (px) reserved on the right for the floating Temur dock. */
export const TEMUR_DOCK_PAD = 430;

/**
 * Reactive extra right padding so a centered modal shifts LEFT and sits *beside*
 * the floating Temur panel (desktop only). When Temur is minimized to the corner
 * pill, no room is reserved — the modal uses full width. Call at the top of a
 * modal component and spread the result into the backdrop style.
 */
export function useTemurBesidePad(): { padding?: string } {
  const min = useTemurMinimized();
  if (!min && typeof window !== "undefined" && window.innerWidth >= 1100) {
    // full `padding` shorthand (overrides the backdrop's padding:22 without mixing
    // shorthand + longhand, which React warns about)
    return { padding: `22px ${TEMUR_DOCK_PAD}px 22px 22px` };
  }
  return {};
}
