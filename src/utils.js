// Форматтеры, общие для всех экранов.

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function formatNum(v) {
  if (v == null || Number.isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

// Форматтер для подписей осей/тиков recharts: ≤2 знака после запятой без
// хвостовых нулей (5 → «5», 5.4 → «5.4», 5.472 → «5.47»). Не-число возвращаем как есть.
// Отдельно от formatNum (тот даёт фиксированную точность для карточек/значений).
export function fmt2(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return v;
  return String(Math.round(v * 100) / 100);
}

// YYYY-MM-DD → "22 мар 2026"
export function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${parseInt(day, 10)} ${MONTHS_RU[parseInt(m, 10) - 1]} ${y}`;
}

// ISO datetime или дата → "22 мар 2026, 09:14" (для маркера свежести)
export function formatIngest(iso) {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const date = `${dt.getDate()} ${MONTHS_RU[dt.getMonth()]} ${dt.getFullYear()}`;
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${date}, ${hh}:${mm}`;
}

export function daysSince(dateStr, today = new Date()) {
  const then = new Date(dateStr);
  return Math.round((today - then) / 86400000);
}

export const toNum = (d) => new Date(d).getTime();

export function fmtXMonthYear(ts) {
  const dt = new Date(ts);
  return `${String(dt.getFullYear()).slice(2)}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export function fmtYear(ts) {
  return String(new Date(ts).getFullYear());
}

export function fmtDateShort(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}
