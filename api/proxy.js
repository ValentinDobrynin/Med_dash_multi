// Vercel serverless: единый прокси /api/* → Render health-multi (PLAN_multiuser v3 §6.2–6.3).
//
// Мультитенантные принципы:
// - НИКАКИХ токенов в прокси: ни READ_TOKEN, ни LAB_INGEST_TOKEN. Авторизация —
//   httpOnly cookie сессии, прокси лишь пробрасывает Cookie туда и Set-Cookie обратно.
// - Cache-Control: private, no-store на каждый ответ (§3.2 п.5) — утечка через
//   CDN-кэш недопустима.
// - Бинарные ответы (PDF-отчёт, NDJSON-экспорт) передаются как Buffer
//   с Content-Disposition как есть.
//
// Vercel rewrite (vercel.json): /api/(.*) → /api/proxy?path=$1
export const config = { api: { bodyParser: false } };

// Первые сегменты путей, которые прокси согласен передавать (реестр §3.2 п.6).
const ALLOWED_FIRST = new Set([
  'labs', 'weight', 'dictionary', 'health', 'export',
  'auth', 'bot', 'ingest', 'admin',
]);

export default async function handler(req, res) {
  const base = process.env.RENDER_API_URL;
  if (!base) {
    res.status(500).json({ error: 'RENDER_API_URL is not configured' });
    return;
  }

  const { path = '', ...rest } = req.query;
  const cleanPath = String(path).replace(/^\/+|\/+$/g, '');
  if (!ALLOWED_FIRST.has(cleanPath.split('/')[0])) {
    res.status(404).json({ error: 'Unknown API path' });
    return;
  }

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(rest)) {
    if (Array.isArray(v)) v.forEach((item) => qs.append(k, item));
    else if (v != null) qs.append(k, v);
  }
  const url = `${base.replace(/\/+$/, '')}/${cleanPath}${qs.size ? `?${qs}` : ''}`;

  const headers = { Accept: 'application/json' };
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  if (req.headers.authorization) headers.Authorization = req.headers.authorization;

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks);
  }

  try {
    const upstream = await fetch(url, { method: req.method, headers, body });

    res.status(upstream.status);
    res.setHeader('Content-Type',
      upstream.headers.get('content-type') || 'application/json');
    res.setHeader('Cache-Control', 'private, no-store');
    const disposition = upstream.headers.get('content-disposition');
    if (disposition) res.setHeader('Content-Disposition', disposition);

    // Set-Cookie: сессия ставится на домен дэша (same-origin) — пробрасываем все.
    const setCookies = upstream.headers.getSetCookie
      ? upstream.headers.getSetCookie()
      : (upstream.headers.get('set-cookie') ? [upstream.headers.get('set-cookie')] : []);
    if (setCookies.length) res.setHeader('Set-Cookie', setCookies);

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    res.status(502).json({ error: 'Upstream fetch failed', detail: String(err) });
  }
}
