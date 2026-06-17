/** Open the in-app issue detail popup (works without Jira access). */
export function openIssue(key: string) {
  window.dispatchEvent(new CustomEvent("pn-issue", { detail: { key } }));
}
