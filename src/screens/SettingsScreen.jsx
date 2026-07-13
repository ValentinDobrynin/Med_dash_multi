import { useEffect, useState } from 'react';
import { T } from '../theme.js';
import {
  botBindCode, botConnect, botDisconnect, botStatus,
  changePassword, myDataDownloadUrl,
} from '../api.js';

// Настройки (PLAN_multiuser v3 §5.2, §5.5, §7): бот (опционально), пароль,
// «Скачать мои данные».
export default function SettingsScreen({ me, refreshMe }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BotSection me={me} refreshMe={refreshMe} />
      <PasswordSection />
      <DataSection />
    </div>
  );
}

const card = {
  background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20,
};
const h2 = {
  fontFamily: T.fontDisplay, fontStyle: 'italic', fontWeight: 500,
  color: T.ink, fontSize: 20, margin: '0 0 12px',
};
const input = {
  width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
  background: T.bg, border: `1px solid ${T.border}`, color: T.ink,
  fontFamily: T.fontBody, outline: 'none', boxSizing: 'border-box',
};
const btn = (accent) => ({
  padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
  background: accent ? 'rgba(129,140,248,0.16)' : T.bg,
  border: `1px solid ${accent ? T.accent : T.border}`,
  color: accent ? T.accent : T.inkSoft,
});

function BotSection({ me, refreshMe }) {
  const bot = me?.bot || {};
  const [token, setToken] = useState('');
  const [bind, setBind] = useState(null); // {bind_code, hint}
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const loadStatus = () => botStatus().then(setStatus).catch(() => setStatus(null));
  useEffect(() => { if (bot.connected) loadStatus(); }, [bot.connected]);

  const run = (fn) => async () => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(String(e.message || e)); } finally { setBusy(false); }
  };

  return (
    <section style={card}>
      <h2 style={h2}>Telegram-бот <span style={{ color: T.inkMuted, fontSize: 12, fontStyle: 'normal', fontFamily: T.fontMono }}>опционально</span></h2>

      {!bot.connected && (
        <>
          <ol style={{ color: T.inkSoft, fontSize: 13, lineHeight: 1.7, paddingLeft: 18, margin: '0 0 14px' }}>
            <li>Открой в Telegram <b>@BotFather</b> → команда <code>/newbot</code>.</li>
            <li>Придумай имя и username бота (например, <code>vasya_health_bot</code>).</li>
            <li>Скопируй выданный токен вида <code>1234567:AA…</code> и вставь сюда.</li>
          </ol>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input style={{ ...input, flex: 1, minWidth: 220 }} placeholder="токен от BotFather"
                   value={token} onChange={(e) => setToken(e.target.value)} />
            <button className="tap" disabled={busy || !token.trim()} style={btn(true)}
                    onClick={run(async () => {
                      const r = await botConnect(token.trim());
                      setBind(r); setToken('');
                      await refreshMe();
                    })}>
              Подключить
            </button>
          </div>
          <div style={{ color: T.inkMuted, fontSize: 11, marginTop: 8 }}>
            Бот не обязателен: загрузка PDF, ввод веса и отчёты работают прямо здесь, на дэше.
          </div>
        </>
      )}

      {bot.connected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: T.inkSoft }}>
            Бот: <b style={{ color: T.ink }}>@{bot.username}</b>
            {' · '}привязка: {bot.bound
              ? <span style={{ color: '#34d399' }}>✓ активна</span>
              : <span style={{ color: '#fbbf24' }}>ожидает /start</span>}
            {status && (
              <>
                {' · '}вебхук: {status.webhook_ok
                  ? <span style={{ color: '#34d399' }}>✓ ок</span>
                  : <span style={{ color: '#f87171' }}>✕ проблема</span>}
              </>
            )}
          </div>

          {!bot.bound && (
            <div style={{ padding: 14, borderRadius: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', fontSize: 13, color: T.inkSoft, lineHeight: 1.6 }}>
              {bind ? (
                <>
                  Отправь своему боту <b>@{bind.bot_username || bot.username}</b> сообщение:{' '}
                  <code style={{ userSelect: 'all', color: T.ink }}>/start {bind.bind_code}</code>
                  <div style={{ color: T.inkMuted, fontSize: 11, marginTop: 6 }}>
                    Код одноразовый, живёт 15 минут. Не подошёл — перевыпусти.
                  </div>
                </>
              ) : (
                <>Код привязки истёк или использован — перевыпусти и отправь боту /start &lt;код&gt;.</>
              )}
              <div style={{ marginTop: 10 }}>
                <button className="tap" disabled={busy} style={btn(false)}
                        onClick={run(async () => setBind(await botBindCode()))}>
                  Перевыпустить код
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="tap" disabled={busy} style={btn(false)}
                    onClick={run(async () => { await loadStatus(); await refreshMe(); })}>
              Проверить
            </button>
            <button className="tap" disabled={busy} style={{ ...btn(false), color: '#f87171', borderColor: 'rgba(248,113,113,0.4)' }}
                    onClick={run(async () => { await botDisconnect(); setBind(null); await refreshMe(); })}>
              Отключить бота
            </button>
          </div>
        </div>
      )}

      {error && <div style={{ marginTop: 10, color: '#fca5a5', fontSize: 12 }}>{error}</div>}
    </section>
  );
}

function PasswordSection() {
  const [oldP, setOldP] = useState('');
  const [newP, setNewP] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await changePassword(oldP, newP);
      setMsg({ ok: true, text: 'Пароль обновлён' });
      setOldP(''); setNewP('');
    } catch (err) {
      setMsg({ ok: false, text: String(err.message || err) });
    } finally { setBusy(false); }
  };

  return (
    <section style={card}>
      <h2 style={h2}>Пароль</h2>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input style={{ ...input, flex: 1, minWidth: 160 }} type="password" placeholder="текущий"
               autoComplete="current-password" value={oldP} onChange={(e) => setOldP(e.target.value)} required />
        <input style={{ ...input, flex: 1, minWidth: 160 }} type="password" placeholder="новый (мин. 8)"
               autoComplete="new-password" minLength={8} value={newP} onChange={(e) => setNewP(e.target.value)} required />
        <button type="submit" className="tap" disabled={busy} style={btn(true)}>Сменить</button>
      </form>
      {msg && <div style={{ marginTop: 10, fontSize: 12, color: msg.ok ? '#34d399' : '#fca5a5' }}>{msg.text}</div>}
      <div style={{ color: T.inkMuted, fontSize: 11, marginTop: 8 }}>
        Забыл пароль и не можешь войти — reset-код выдаёт администратор.
      </div>
    </section>
  );
}

function DataSection() {
  return (
    <section style={card}>
      <h2 style={h2}>Мои данные</h2>
      <div style={{ color: T.inkSoft, fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
        Полный дамп твоих анализов и веса (NDJSON) — переносимость и личный бэкап.
        Полное удаление аккаунта с данными — по запросу администратору.
      </div>
      <a href={myDataDownloadUrl()} className="tap"
         style={{ ...btn(true), textDecoration: 'none', display: 'inline-block' }}>
        ⬇ Скачать мои данные
      </a>
    </section>
  );
}
