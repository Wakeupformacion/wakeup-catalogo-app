const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const slugify = require('slugify');
const xlsx = require('xlsx');
const { randomUUID } = require('crypto');

const fallbackPath = path.join(__dirname, 'data', 'catalog-fallback.json');
const uploadsDir = path.join(__dirname, 'data', 'uploads');

function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const idx = part.indexOf('=');
      if (idx === -1) return acc;
      const key = decodeURIComponent(part.slice(0, idx).trim());
      const value = decodeURIComponent(part.slice(idx + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

function signValue(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function createAdminSession(username, secret) {
  const payload = `${username}:${Date.now()}`;
  return `${payload}.${signValue(payload, secret)}`;
}

function verifyAdminSession(token, secret) {
  if (!token || !secret) return null;
  const idx = token.lastIndexOf('.');
  if (idx === -1) return null;
  const payload = token.slice(0, idx);
  const signature = token.slice(idx + 1);
  const expected = signValue(payload, secret);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const [username] = payload.split(':');
  return username || null;
}

function getAdminAuthConfig() {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || '',
    secret: process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || 'change-me-admin-secret',
  };
}

function normalizeCourseInput(input = {}, existing = {}) {
  const title = String(input.title || '').trim();
  const categoryRaw = String(input.category_raw || '').trim();
  const categoryNormalized = slugify(categoryRaw || existing.category_raw || title, { lower: true, strict: true, locale: 'es' });
  const courseCodeRaw = String(input.course_code || existing.course_code || '').trim();
  const slugBase = slugify(title || existing.title || courseCodeRaw || randomUUID(), { lower: true, strict: true, locale: 'es' });
  const hoursValue = String(input.hours || '').trim();
  const parsedHours = hoursValue ? parseInt(hoursValue, 10) : null;

  return {
    course_code: courseCodeRaw || slugBase.toUpperCase(),
    title,
    title_normalized: slugify(title, { lower: true, strict: true, locale: 'es' }),
    slug: String(input.slug || existing.slug || slugBase).trim() || slugBase,
    category_raw: categoryRaw,
    category_normalized: categoryNormalized,
    hours: Number.isFinite(parsedHours) ? parsedHours : null,
    delivery_mode: String(input.delivery_mode || existing.delivery_mode || 'online').trim() || 'online',
    detail_url: String(input.detail_url || '').trim(),
    language: String(input.language || existing.language || 'es').trim() || 'es',
    is_active: input.is_active === 'on' || input.is_active === true || input.is_active === 'true',
  };
}

function buildSearchText(course) {
  return [
    course.title,
    course.category_raw,
    course.course_code,
    course.delivery_mode,
  ].filter(Boolean).join(' · ');
}

function readFallbackCourses() {
  const raw = fs.readFileSync(fallbackPath, 'utf8');
  return JSON.parse(raw);
}

function writeFallbackCourses(courses) {
  fs.writeFileSync(fallbackPath, `${JSON.stringify(courses, null, 2)}\n`, 'utf8');
}

function parseDelimitedText(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((item) => item.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
}

function parseExcelFile(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: '' });
}

module.exports = {
  uploadsDir,
  ensureUploadsDir,
  parseCookies,
  createAdminSession,
  verifyAdminSession,
  getAdminAuthConfig,
  normalizeCourseInput,
  buildSearchText,
  readFallbackCourses,
  writeFallbackCourses,
  parseDelimitedText,
  parseExcelFile,
};
