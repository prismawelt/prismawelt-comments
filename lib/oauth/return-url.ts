export function parseCommentReturnUrl(value: unknown): URL {
  if (typeof value !== 'string') throw new Error('Invalid return URL');
  const url = new URL(value);
  const allowed = new Set([
    'https://prismawelt.github.io',
    'https://prismawelt-comments.vercel.app',
  ]);
  if (!allowed.has(url.origin) || url.username || url.password) {
    throw new Error('Invalid return URL');
  }
  return url;
}
