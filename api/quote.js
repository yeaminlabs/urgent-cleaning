// Vercel serverless function (Node.js runtime, zero dependencies).
// Receives the homepage quote-request form, validates and sanitizes it
// server-side, and emails it to Urgent Clean via the Resend API.
//
// Required environment variable (Vercel Project Settings -> Environment Variables):
//   RESEND_API_KEY   secret API key from resend.com
// Optional:
//   RESEND_FROM       verified sender once a domain is set up with Resend,
//                      e.g. "Urgent Clean <quotes@urgentcleankamloops.ca>".
//                      Defaults to Resend's shared onboarding sender, which
//                      works without any domain verification.

const TO_EMAIL = 'urgentcleankamloops@gmail.com';
const DEFAULT_FROM = 'Urgent Clean Website <onboarding@resend.dev>';

const ALLOWED_SERVICES = new Set([
  'House Cleaning',
  'Same-Day / Short-Notice Cleaning',
  'Move-Out Cleaning',
  'Move-In Cleaning',
  'Deep Cleaning',
  'Rental Turnover Cleaning',
  'Post-Renovation Cleaning',
  'Recurring Cleaning',
  'Other',
]);

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3MB — keeps the base64 payload safely under Vercel's request-body limit

function sanitize(value, maxLen) {
  if (typeof value !== 'string') return '';
  // Strip control characters (including CR/LF, which could otherwise enable
  // email header injection) and cap length before anything touches the email.
  return value.replace(/[\r\n\t\x00-\x1F\x7F]+/g, ' ').trim().slice(0, maxLen);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body && typeof body === 'object' ? body : {};

  // Honeypot: real visitors never fill this hidden field. Bots that do get a
  // normal-looking success response, but nothing is actually sent.
  if (sanitize(body.company, 200)) {
    res.status(200).json({ ok: true });
    return;
  }

  const name        = sanitize(body.name, 100);
  const phone       = sanitize(body.phone, 40);
  const email       = sanitize(body.email, 200);
  const service     = sanitize(body.service, 100);
  const description = sanitize(body.description, 2000);
  const location     = sanitize(body.location, 150);
  const bedrooms     = sanitize(body.bedrooms, 20);
  const timing       = sanitize(body.timing, 40);
  // Informational only, set by the calculator handoff — never trusted for
  // pricing or logic, just relayed to the email like any other free-text field.
  const estimatorContext = sanitize(body.estimatorContext, 500);

  const errors = [];
  if (!phone || !isValidPhone(phone)) errors.push('A valid phone number is required.');
  if (!email || !isValidEmail(email)) errors.push('A valid email address is required.');
  if (!service || !ALLOWED_SERVICES.has(service)) errors.push('Please choose a valid service.');
  if (!description) errors.push('Please briefly describe what needs cleaning.');

  if (errors.length) {
    res.status(400).json({ ok: false, error: 'validation_failed', details: errors });
    return;
  }

  // Optional single-photo attachment
  let attachments;
  const photo = body.photo;
  if (photo && typeof photo === 'object' && typeof photo.dataUrl === 'string') {
    const match = /^data:([^;]+);base64,(.+)$/.exec(photo.dataUrl);
    if (!match) {
      res.status(400).json({ ok: false, error: 'invalid_photo' });
      return;
    }
    const [, mime, base64] = match;
    if (!ALLOWED_PHOTO_TYPES.has(mime)) {
      res.status(400).json({ ok: false, error: 'unsupported_photo_type' });
      return;
    }
    const approxBytes = base64.length * 0.75; // base64 -> decoded byte size
    if (approxBytes > MAX_PHOTO_BYTES) {
      res.status(400).json({ ok: false, error: 'photo_too_large' });
      return;
    }
    const safeName = (sanitize(photo.name, 120).replace(/[^a-zA-Z0-9._-]/g, '_')) || 'photo.jpg';
    attachments = [{ filename: safeName, content: base64 }];
  }

  const submittedAt = new Date().toLocaleString('en-CA', {
    timeZone: 'America/Vancouver',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const lines = [
    'NEW QUOTE REQUEST',
    '',
    `Name: ${name || 'Not provided'}`,
    `Phone: ${phone}`,
    `Email: ${email}`,
    `Service: ${service}`,
    `Description: ${description}`,
    '',
    'OPTIONAL DETAILS',
    '',
    `Bedrooms: ${bedrooms || 'Not provided'}`,
    `Location: ${location || 'Not provided'}`,
    `Preferred timing: ${timing || 'Not provided'}`,
    `Photo: ${attachments ? `Attached (${attachments[0].filename})` : 'Not provided'}`,
  ];

  if (estimatorContext) {
    lines.push('', 'ESTIMATOR CONTEXT', '', estimatorContext);
  }

  lines.push(
    '',
    `Submitted: ${submittedAt} (Kamloops time)`,
    'Source: www.urgentcleankamloops.ca homepage quote form',
  );

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    res.status(500).json({ ok: false, error: 'email_not_configured' });
    return;
  }

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || DEFAULT_FROM,
        to: [TO_EMAIL],
        reply_to: email,
        subject: `New Urgent Clean Quote Request — ${service}`,
        text: lines.join('\n'),
        attachments,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => '');
      console.error('Resend API error', resendRes.status, errText);
      res.status(502).json({ ok: false, error: 'send_failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Failed to send quote request email', err);
    res.status(500).json({ ok: false, error: 'send_failed' });
  }
};
