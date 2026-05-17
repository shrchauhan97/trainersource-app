// Validates a `?next=…` redirect target. Must be a same-site absolute
// path (e.g. /dashboard, /admin/trainers). Rejects:
//   - empty / non-string
//   - protocol-relative ("//evil.com", "/\\evil.com") which Location:
//     resolves as a cross-origin redirect
//   - schemes ("javascript:", "data:")
//   - anything that isn't /<alnum/_/-/>* characters
export function safeNext(rawNext: string | null | undefined, fallback: string): string {
  if (!rawNext || typeof rawNext !== 'string') return fallback;
  if (rawNext.startsWith('//')) return fallback;
  if (rawNext.startsWith('/\\')) return fallback;
  if (!/^\/[A-Za-z0-9_\-/]*$/.test(rawNext)) return fallback;
  return rawNext;
}
