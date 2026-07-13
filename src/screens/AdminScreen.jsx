import { useCallback, useEffect, useState } from 'react';
import { T } from '../theme.js';
import {
  adminCreateInvite, adminOverview, adminRejects, adminResetCode, adminUsers,
} from '../api.js';

// Admin-вкладка (PLAN_multiuser v3 §7): юзеры, инвайты, reset-коды, reject-логи.
// Видна только role=admin; авторизация — та же сессия (прокси токенов не несёт).
export default function AdminScreen() {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [invite, setInvite] = useState(null);
  const [resetInfo, setResetInfo] = useState(null);
  const [rejects, setRejects] = useState(null); // {login, items}
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setOverview(await adminOverview());
      setUsers(await adminUsers());
    } catch (e) {
      setError(String(e.message || e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = (fn) => async () => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(String(e.message || e)); } finally { setBusy(false); }
  };

  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 };
  const h2 = { fontFamily: T.fontDisplay, fontStyle: 'italic', fontWeight: 500, color: T.ink, fontSize: 20, margin: '0 0 12px' };
  const btn = { padding: '9px 16px', borderRadius: 10, fontSize: 13, background: 'rgba(129,140,248,0.16)', border: `1px solid ${T.accent}`, color: T.accent };
  const mono = { fontFamily: T.fontMono };

  const inviteLink = invite ? `${window.location.origin}/?code=${invite.code}` : null;
  const resetLink = resetInfo ? `${window.location.origin}/?reset=${resetInfo.code}` : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      <section style={card}>
        <h2 style={h2}>Обзор</h2>
        {overview ? (
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, color: T.inkSoft, ...mono }}>
            <span>юзеров: <b style={{ color: T.ink }}>{overview.users}</b></span>
            <span>лаб: <b style={{ color: T.ink }}>{overview.labs_count}</b></span>
            <span>весов: <b style={{ color: T.ink }}>{overview.weight_count}</b></span>
            <span>маркеров: <b style={{ color: T.ink }}>{overview.analytes_count}</b></span>
            <span>pending: <b style={{ color: T.ink }}>{overview.pending}</b></span>
          </div>
        ) : '…'}
      </section>

      <section style={card}>
        <h2 style={h2}>Инвайты</h2>
        <button className="tap" style={btn} disabled={busy}
                onClick={run(async () => setInvite(await adminCreateInvite('из админки')))}>
          Создать инвайт
        </button>
        {invite && (
          <div style={{ marginTop: 12, fontSize: 13, color: T.inkSoft, lineHeight: 1.7 }}>
            Ссылка (одноразовая, истекает {invite.expires_at?.slice(0, 10)}):
            <div><code style={{ userSelect: 'all', color: T.ink, wordBreak: 'break-all' }}>{inviteLink}</code></div>
          </div>
        )}
      </section>

      <section style={card}>
        <h2 style={h2}>Пользователи</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: T.inkMuted, textAlign: 'left', ...mono }}>
                {['логин', 'имя', 'роль', 'бот', 'лаб', 'весов', 'создан', ''].map((h) => (
                  <th key={h} style={{ padding: '6px 10px', borderBottom: `1px solid ${T.border}`, fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} style={{ color: T.inkSoft }}>
                  <td style={{ padding: '7px 10px', color: T.ink, ...mono }}>{u.login}</td>
                  <td style={{ padding: '7px 10px' }}>{u.name}</td>
                  <td style={{ padding: '7px 10px' }}>{u.role}</td>
                  <td style={{ padding: '7px 10px' }}>
                    {u.bot_connected ? (u.bot_bound ? `✓ @${u.bot_username}` : '⏳ не привязан') : '—'}
                  </td>
                  <td style={{ padding: '7px 10px', ...mono }}>{u.labs_count}</td>
                  <td style={{ padding: '7px 10px', ...mono }}>{u.weight_count}</td>
                  <td style={{ padding: '7px 10px', ...mono }}>{u.created_at?.slice(0, 10)}</td>
                  <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                    <button className="tap" disabled={busy}
                            style={{ background: 'none', border: 'none', color: T.accent, textDecoration: 'underline', fontSize: 12, marginRight: 10 }}
                            onClick={run(async () => setResetInfo({ ...(await adminResetCode(u.user_id)), login: u.login }))}>
                      reset-код
                    </button>
                    <button className="tap" disabled={busy}
                            style={{ background: 'none', border: 'none', color: T.inkMuted, textDecoration: 'underline', fontSize: 12 }}
                            onClick={run(async () => setRejects({ login: u.login, items: await adminRejects(u.user_id) }))}>
                      rejects
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {resetInfo && (
          <div style={{ marginTop: 12, fontSize: 13, color: T.inkSoft, lineHeight: 1.7 }}>
            Reset-ссылка для <b style={{ color: T.ink }}>{resetInfo.login}</b> (действует 2 дня):
            <div><code style={{ userSelect: 'all', color: T.ink, wordBreak: 'break-all' }}>{resetLink}</code></div>
          </div>
        )}
      </section>

      {rejects && (
        <section style={card}>
          <h2 style={h2}>Rejects · {rejects.login}</h2>
          {rejects.items.length === 0 && (
            <div style={{ color: T.inkMuted, fontSize: 13 }}>Пусто — все маркеры распознаются.</div>
          )}
          {rejects.items.map((it) => (
            <div key={it.id} style={{ marginBottom: 12, fontSize: 12.5, color: T.inkSoft }}>
              <div style={{ ...mono, color: T.ink }}>{it.filename} · {it.created_at?.slice(0, 10)} · {it.status}</div>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {it.rejects.map((r, i) => (
                  <li key={i}>{r.name || r.reason}{r.name && r.reason ? ` — ${r.reason}` : ''}</li>
                ))}
              </ul>
            </div>
          ))}
          <div style={{ color: T.inkMuted, fontSize: 11, marginTop: 6 }}>
            Незамапленные маркеры → синонимы в парсер (все четыре копии, §3.4 плана) → деплой.
          </div>
        </section>
      )}
    </div>
  );
}
