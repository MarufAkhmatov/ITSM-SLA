export const JIRA_FALLBACK = "https://jira.ipakyulibank.uz";

/** Build the original Jira issue URL. Prefers the exact url from the export,
 *  otherwise builds {base}/browse/{KEY}. */
export function jiraUrl(key: string, url?: string, base?: string): string {
  if (url && url.includes("/browse/")) return url;
  const b = (base && base.startsWith("http")) ? base : JIRA_FALLBACK;
  return `${b}/browse/${key}`;
}
