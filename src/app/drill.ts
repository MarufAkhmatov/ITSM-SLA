/** Fire a drill-down: any number can call this to open the issue-list popup. */
export function openDrill(title: string, params: Record<string, string>) {
  window.dispatchEvent(new CustomEvent("pn-drill", { detail: { title, params } }));
}
