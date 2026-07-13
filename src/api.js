// Слой доступа к API health-multi (PLAN_multiuser v3).
// Клиент всегда ходит на относительный /api/* (same-origin):
//   dev  — vite proxy → VITE_API_URL (см. vite.config.js);
//   prod — Vercel rewrite → api/proxy.js → RENDER_API_URL.
// Авторизация — httpOnly cookie сессии (ставит сервер через прокси).
// НИКАКИХ токенов на клиенте и в прокси.

const BASE = '/api';

async function req(path, { method = 'GET', json, body } = {}) {
  const opts = { method, headers: { Accept: 'application/json' } };
  if (json !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(json);
  } else if (body !== undefined) {
    opts.body = body;
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail || data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// --- Auth ---------------------------------------------------------------

export const fetchMe = () => req('/auth/me');
export const login = (loginName, password) =>
  req('/auth/login', { method: 'POST', json: { login: loginName, password } });
export const registerUser = (payload) =>
  req('/auth/register', { method: 'POST', json: payload });
export const logout = () => req('/auth/logout', { method: 'POST' });
export const changePassword = (oldPass, newPass) =>
  req('/auth/change_password', { method: 'POST', json: { old: oldPass, new: newPass } });
export const resetPassword = (code, newPass) =>
  req('/auth/reset_password', { method: 'POST', json: { code, new: newPass } });

// --- Бот (§5.2) -----------------------------------------------------------

export const botConnect = (token) => req('/bot/connect', { method: 'POST', json: { token } });
export const botBindCode = () => req('/bot/bind_code', { method: 'POST' });
export const botDisconnect = () => req('/bot/disconnect', { method: 'POST' });
export const botStatus = () => req('/bot/status');

// --- Данные ---------------------------------------------------------------

export const fetchLabs = () => req('/labs');
export const fetchWeight = () => req('/weight');
export const fetchDictionary = () => req('/dictionary');
export const fetchHealth = () => req('/health');

// Медкарта — в мультиюзер v1 не входит (§8 плана); экран скрыт, функция оставлена
// заглушкой на v2.
export const getEvents = () => Promise.resolve([]);

// Ручной ввод веса (§5.5 — дэш самодостаточен без бота).
export const addWeightEntry = (measureDate, weightKg) =>
  req('/weight/entry', { method: 'POST', json: { measure_date: measureDate, weight_kg: weightKg } });

// Экспорт PDF в Telegram (нужен подключённый и привязанный бот).
export async function exportToTelegram(kind, id) {
  return req(`/export/telegram?kind=${kind}&id=${encodeURIComponent(id)}`);
}

// URL скачивания PDF-отчёта в браузере (§5.5) и своего NDJSON-дампа (§7).
export const reportDownloadUrl = (kind, id) =>
  `${BASE}/export/report?kind=${kind}&id=${encodeURIComponent(id)}`;
export const myDataDownloadUrl = () => `${BASE}/export`;

// --- Загрузка лаб-PDF (сессия; квоты на сервере) ---------------------------

export async function uploadLabPdf(file) {
  const fd = new FormData();
  fd.append('file', file, file.name);
  const res = await fetch(`${BASE}/ingest/pdf`, { method: 'POST', body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  return body;
}

export const confirmLabPdf = (pendingId) =>
  req(`/ingest/pdf/confirm?id=${encodeURIComponent(pendingId)}`, { method: 'POST' });
export const cancelLabPdf = (pendingId) =>
  req(`/ingest/pdf/cancel?id=${encodeURIComponent(pendingId)}`, { method: 'POST' });

// --- Админ (сессия role=admin; прокси токенов НЕ несёт) --------------------

export const adminOverview = () => req('/admin/overview');
export const adminUsers = () => req('/admin/users');
export const adminCreateInvite = (note) =>
  req('/admin/invites', { method: 'POST', json: { note } });
export const adminResetCode = (userId) =>
  req('/admin/reset_code', { method: 'POST', json: { user_id: userId } });
export const adminRejects = (userId) =>
  req(`/admin/rejects?user_id=${encodeURIComponent(userId)}`);

// --- Всё разом для useHealthData -------------------------------------------

export async function fetchAll() {
  const [labs, weight, dictionary, health, events] = await Promise.all([
    fetchLabs(),
    fetchWeight(),
    fetchDictionary(),
    fetchHealth(),
    getEvents().catch(() => []),
  ]);
  return { labs, weight, dictionary, health, events };
}
