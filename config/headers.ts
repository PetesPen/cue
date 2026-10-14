// Security headers for the deployed app. The same values are in netlify.toml, which cannot import
// this file; tests/netlify.test.ts fails if the two drift apart. `vite preview` serves these too, so
// the end-to-end tests run under the real policy and a blocked request shows up as a console error.
//
// The policy enforces the rule that Cue makes no external requests (CLAUDE.md, HTML export).
// 'unsafe-inline' is allowed for styles only, because React and the slide renderer set style
// attributes. If a story needs a host added here, ask Peter.

export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': contentSecurityPolicy,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
