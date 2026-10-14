/* ============================================================================
   Routing Middleware — HTTP Basic Auth for the internal team price guide
   ----------------------------------------------------------------------------
   Protects /team-price-guide (and everything under it) and NOTHING else. The
   public site, the blog, the service pages and /api/quote are untouched: the
   matcher in vercel.json keeps this code off every other route, and the guard
   below refuses to act on any path outside the guide even if that matcher is
   ever widened by mistake.

   SELF-CONTAINED BY DESIGN: this gate needs no Vercel environment variables, so
   it works on a deployment nobody has dashboard access to. The expected
   username and password are stored as SHA-256 digests and the incoming values
   are hashed before a constant-time comparison.

   HONEST LIMITATION: hashing stops the credentials being *readable* at a
   glance, but it does not make them secret. The password is short and common,
   so anyone with this file can recover it in seconds with a lookup table. Treat
   this as a lightweight staff gate over TLS — enough to keep the rate card off
   the open web and out of search results, not real authentication. Nothing
   personal or customer-identifying belongs behind it, and changing the password
   means editing these digests and redeploying.

   The file is .mjs on purpose: Routing Middleware is ESM, and this project's
   package.json has no "type": "module" because api/quote.js and the QA scripts
   are CommonJS. Renaming would break those; a .mjs entrypoint avoids it.
   ========================================================================== */
import { next } from '@vercel/functions';
import { createHash, timingSafeEqual } from 'node:crypto';

const REALM = 'Urgent Clean Team';
const PROTECTED = '/team-price-guide';

/* SHA-256 of the expected username and password. To change the credentials,
   run:  node -e "console.log(require('crypto').createHash('sha256').update('NEW').digest('hex'))"
   replace the matching digest below, and redeploy. */
const USER_SHA256 = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
const PASS_SHA256 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

/* Keep the crawler directives on both the challenge and the page itself, so the
   guide can never be indexed or archived even by something that holds the
   credentials. robots.txt deliberately says nothing — a Disallow line there
   would publish the path to anyone who reads it. */
const NO_INDEX = 'noindex, nofollow, noarchive';

const isProtected = (pathname) => pathname === PROTECTED || pathname.startsWith(PROTECTED + '/');

/* Constant-time comparison: hash the supplied value and compare digests, so
   both sides are always the same length and the comparison leaks no timing
   information about how much of the value matched. */
function matches(received, expectedHex) {
  if (typeof received !== 'string' || received.length === 0) return false;
  const a = createHash('sha256').update(received, 'utf8').digest();
  const b = Buffer.from(expectedHex, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function unauthorized() {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': NO_INDEX,
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export default function proxy(request) {
  const { pathname } = new URL(request.url);

  // Defence in depth: never touch anything outside the guide.
  if (!isProtected(pathname)) return next();

  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');
  if (!encoded || scheme.toLowerCase() !== 'basic') return unauthorized();

  let decoded = '';
  try { decoded = Buffer.from(encoded, 'base64').toString('utf8'); } catch { return unauthorized(); }

  // Only the FIRST colon separates user from password — passwords may contain colons.
  const sep = decoded.indexOf(':');
  if (sep === -1) return unauthorized();
  const givenUser = decoded.slice(0, sep);
  const givenPass = decoded.slice(sep + 1);

  // Both comparisons always run, so a wrong username costs the same as a wrong password.
  const userOk = matches(givenUser, USER_SHA256);
  const passOk = matches(givenPass, PASS_SHA256);
  if (!(userOk && passOk)) return unauthorized();

  return next({
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': NO_INDEX,
    },
  });
}
