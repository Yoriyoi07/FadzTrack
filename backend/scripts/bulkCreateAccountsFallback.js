#!/usr/bin/env node
/**
 * Fallback Bulk Account Creation Script
 * ------------------------------------
 * Use this if the /api/auth/bulk-register upload endpoint is unavailable.
 *
 * Usage:
 *   node scripts/bulkCreateAccountsFallback.js --file ./path/to/accounts.csv [--dry-run] [--no-email]
 *
 * CSV Format (header required):
 *   name,email,role,phone
 * Additional columns are ignored.
 *
 * Behavior:
 *  - Validates required fields (name,email,role). Phone optional (will set to placeholder if missing).
 *  - Skips existing emails (reports as 'exists').
 *  - Generates random temp password (unless --dry-run) and sets account inactive (accountStatus='Inactive').
 *  - Sends activation email unless --no-email or --dry-run.
 *  - Report summary + per-row outcomes.
 *
 * ENV required for email sending: EMAIL_USER, EMAIL_PASS (Gmail credentials or configured transporter).
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const User = require('../models/User');

// ---- Config ----
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const FRONTEND_BASE_URL = (process.env.PROD_PUBLIC_URL || process.env.FRONTEND_URL || 'https://fadztrack.online').replace(/\/$/, '');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { dryRun: false, noEmail: false, file: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--no-email') out.noEmail = true;
    else if (a === '--file') out.file = args[++i];
    else if (a.startsWith('--file=')) out.file = a.split('=')[1];
  }
  if (!out.file) {
    console.error('ERROR: --file path/to/accounts.csv is required');
    process.exit(1);
  }
  return out;
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=> l.trim().length);
  if (!lines.length) return { rows: [], error: 'Empty file' };
  const headers = lines[0].split(',').map(h=> h.trim().toLowerCase());
  const idx = {
    name: headers.indexOf('name'),
    email: headers.indexOf('email'),
    role: headers.indexOf('role'),
    phone: headers.indexOf('phone')
  };
  if (idx.name === -1 || idx.email === -1 || idx.role === -1) {
    return { rows: [], error: 'Missing required headers: name,email,role' };
  }
  const rows = lines.slice(1).map((line, i) => {
    const cells = line.split(',');
    return {
      __line: i + 2,
      name: (cells[idx.name] || '').trim(),
      email: (cells[idx.email] || '').trim(),
      role: (cells[idx.role] || '').trim(),
      phone: idx.phone !== -1 ? (cells[idx.phone] || '').trim() : ''
    };
  }).filter(r=> r.name || r.email);
  return { rows };
}

function makeTransport() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null; // skip mail if not configured
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

async function sendActivation(email, activationLink, transport) {
  if (!transport) return { sent: false, skipped: true };
  const html = `<p>Activate your FadzTrack account:</p><p><a href="${activationLink}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Activate Account</a></p><p>If button fails open: ${activationLink}</p>`;
  try {
    await transport.sendMail({ from: 'FadzTrack <no-reply@fadztrack.com>', to: email, subject: 'Activate Your FadzTrack Account', html });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e.message };
  }
}

async function main() {
  const { dryRun, noEmail, file } = parseArgs();
  const fullPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    console.error('File not found:', fullPath); process.exit(1);
  }
  const text = fs.readFileSync(fullPath, 'utf8');
  const { rows, error } = parseCsv(text);
  if (error) { console.error('CSV Error:', error); process.exit(1);} 
  console.log(`Parsed ${rows.length} data rows.`);

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fadztrack');
  console.log('Mongo connected');

  const transport = (dryRun || noEmail) ? null : makeTransport();

  const results = [];
  let created = 0, exists = 0, invalid = 0, errors = 0;
  for (const r of rows) {
    const rowRes = { line: r.__line, email: r.email, status: 'pending' };
    try {
      if (!r.name || !r.email || !r.role) {
        rowRes.status = 'invalid'; invalid++; results.push(rowRes); continue;
      }
      const emailLower = r.email.toLowerCase();
      const existing = await User.findOne({ email: emailLower });
      if (existing) { rowRes.status = 'exists'; exists++; results.push(rowRes); continue; }
      if (dryRun) { rowRes.status = 'would_create'; created++; results.push(rowRes); continue; }
      const tempPassword = crypto.randomBytes(8).toString('hex');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const phone = r.phone || '09000000000';
      await User.create({ name: r.name, email: emailLower, role: r.role, phone, password: hashedPassword, status: 'Inactive', accountStatus: 'Inactive' });
      const activationToken = jwt.sign({ email: emailLower }, JWT_SECRET, { expiresIn: '4h' });
      const link = `${FRONTEND_BASE_URL}/activate-account?token=${activationToken}`;
      if (!noEmail) { await sendActivation(emailLower, link, transport); }
      rowRes.status = 'created'; created++; results.push(rowRes);
    } catch (e) {
      rowRes.status = 'error'; rowRes.reason = e.message; errors++; results.push(rowRes);
    }
  }

  console.table(results.slice(0, 25));
  if (results.length > 25) console.log(`... ${results.length - 25} more rows omitted from console table`);
  console.log('\nSummary:');
  console.log({ totalRows: rows.length, created, exists, invalid, errors, dryRun, emailsSent: dryRun || noEmail ? 0 : created });

  // Optionally write a JSON report
  const reportPath = path.resolve(process.cwd(), `bulk_accounts_report_${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ summary: { totalRows: rows.length, created, exists, invalid, errors, dryRun }, results }, null, 2));
  console.log('Report saved to', reportPath);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(e=> { console.error('Fatal error:', e); process.exit(1); });
