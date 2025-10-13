// utils/mailer.js
// Resilient email sender: prefers Resend HTTP API (https/443) to avoid SMTP egress issues,
// falls back to Nodemailer (Gmail) with sane timeouts when API not configured.
const https = require('https');
const nodemailer = require('nodemailer');

function postJson({ host, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host, path, method: 'POST', headers, timeout: 10000 },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          resolve({ ok, status: res.statusCode, body: data });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });
    req.write(body);
    req.end();
  });
}

async function sendWithResend({ to, subject, html, from }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { used: false, sent: false };
  const payload = JSON.stringify({ from, to, subject, html });
  try {
    const { ok, status, body } = await postJson({
      host: 'api.resend.com',
      path: '/emails',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      body: payload,
    });
    if (!ok) {
      console.warn('[mailer][resend] failed', status, body?.slice?.(0, 200));
      return { used: true, sent: false, status };
    }
    return { used: true, sent: true };
  } catch (e) {
    console.warn('[mailer][resend] error', e?.message || e);
    return { used: true, sent: false, error: e };
  }
}

async function sendWithNodemailer({ to, subject, html, from }) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      pool: true,
      maxConnections: 2,
      maxMessages: 10,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
    });
    const info = await transporter.sendMail({ from, to, subject, html, replyTo: from });
    return { used: true, sent: !!info?.messageId };
  } catch (e) {
    console.warn('[mailer][smtp] error', e?.message || e);
    return { used: true, sent: false, error: e };
  }
}

async function sendMailHtml({ to, subject, html, from }) {
  // Try Resend HTTP API first (HTTPS/443), then SMTP as fallback
  const tryResend = await sendWithResend({ to, subject, html, from });
  if (tryResend.used && tryResend.sent) return { sent: true, via: 'resend' };
  const trySmtp = await sendWithNodemailer({ to, subject, html, from });
  if (trySmtp.sent) return { sent: true, via: 'smtp' };
  return { sent: false, error: trySmtp.error || tryResend.error, via: tryResend.used ? 'resend' : 'smtp' };
}

module.exports = { sendMailHtml };
