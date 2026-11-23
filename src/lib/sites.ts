/** Fill a saved site's search template, e.g. "https://x.com/search?q={query}". */
export function buildSearchUrl(template: string, query: string): string {
  return template.replace("{query}", encodeURIComponent(query.trim()));
}
