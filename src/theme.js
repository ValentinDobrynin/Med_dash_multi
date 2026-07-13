// Дизайн-токены (ТЗ №3 §4): тёмная индиго, JetBrains Mono / Inter / Fraunces.
export const T = {
  bg: '#0a0a1a',
  card: '#12122a',
  cardHover: '#1a1a38',
  border: '#26264a',
  borderSoft: '#1c1c38',
  ink: '#e2e8f0',
  inkSoft: '#94a3b8',
  inkMuted: '#5b6494',
  accent: '#818cf8', // indigo-400 — основной акцент
  amber: '#fbbf24', // единственный тёплый хайлайт (линия веса на Screen C)
  fontDisplay: "'Fraunces', Georgia, serif",
  fontBody: "'Inter', -apple-system, sans-serif",
  fontMono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

// Статус-цвета: вне нормы — красный, у границы — янтарный, ок — зелёный.
export const STATUS_COLORS = {
  alert: { fg: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.32)' },
  warn: { fg: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.26)' },
  ok: { fg: '#34d399', bg: 'rgba(52,211,153,0.07)', border: 'rgba(52,211,153,0.22)' },
  none: { fg: '#5b6494', bg: 'rgba(91,100,148,0.06)', border: 'rgba(91,100,148,0.18)' },
};

export const STATUS_LABELS = {
  alert: 'вне нормы',
  warn: 'у границы',
  ok: 'в норме',
  none: 'инфо',
};
