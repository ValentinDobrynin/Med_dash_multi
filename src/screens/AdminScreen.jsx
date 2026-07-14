import { useCallback, useEffect, useState } from 'react';
import { T } from '../theme.js';
import {
  adminCreateInvite, adminDeleteUser, adminOverview, adminRejects,
  adminResetCode, adminUsers,
} from '../api.js';
import { useMe } from '../me.jsx';

// Admin-вкладка (PLAN_multiuser v3 §7): юзеры, инвайты, reset-коды, reject-логи.
// Видна только role=admin; авторизация — та же сессия (прокси токенов не несёт).
export default function AdminScreen() {
  const me = useMe();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [invite, setInvite] = useState(null);
  const [resetInfo, setResetInfo] = useState(null);
  const [rejects, setRejects] = useState(null); // {login, items}
  const [toDelete, setToDelete] = useState(null); // юзер в модалке удаления
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
                            style={{ background: 'none', border: 'none', color: T.inkMuted, textDecoration: 'underline', fontSize: 12, marginRight: 10 }}
                            onClick={run(async () => setRejects({ login: u.login, items: await adminRejects(u.user_id) }))}>
                      rejects
                    </button>
                    {u.login !== me?.login && (
                      <button className="tap" disabled={busy}
                              style={{ background: 'none', border: 'none', color: '#f87171', textDecoration: 'underline', fontSize: 12 }}
                              onClick={() => setToDelete(u)}>
                        удалить
                      </button>
                    )}
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

      {toDelete && (
        <DeleteUserModal
          user={toDelete}
          onClose={() => setToDelete(null)}
          onDeleted={async () => { setToDelete(null); await load(); }}
        />
      )}
    </div>
  );
}

// Модалка удаления юзера: необратимо, поэтому требует ввести логин точь-в-точь
// (то же подтверждение, что и API: confirm === login). PLAN_multiuser v3 §9.
function DeleteUserModal({ user, onClose, onDeleted }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const match = typed.trim() === user.login;

  const submit = async () => {
    if (!match || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await adminDeleteUser(user.user_id, user.login);
      setResult(r.deleted || {});
      setTimeout(onDeleted, 1200);
    } catch (e) {
      setError(String(e.message || e));
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose}
         style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,17,26,0.72)',
                  backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()}
           style={{ width: 'min(460px, 92vw)', background: T.card,
                    border: '1px solid rgba(248,113,113,0.5)', borderRadius: 18, padding: 24 }}>
        <div style={{ fontFamily: T.fontDisplay, fontStyle: 'italic', fontWeight: 500, fontSize: 22, color: '#f87171', margin: '0 0 10px' }}>
          Удалить пользователя
        </div>

        {result ? (
          <div style={{ color: '#6ee7b7', fontSize: 14, lineHeight: 1.6 }}>
            Удалено. Стёрто: {result.lab_results ?? 0} анализов, {result.weight ?? 0} весов,
            аккаунт и сессии. Бот отключён.
          </div>
        ) : (
          <>
            <div style={{ color: T.inkSoft, fontSize: 13.5, lineHeight: 1.6, marginBottom: 14 }}>
              Это <b style={{ color: T.ink }}>необратимо</b>. Будут стёрты все анализы, вес,
              загрузки и сессии пользователя <b style={{ color: T.ink }}>{user.name}</b> (@{user.login}),
              подключённый бот — отключён. Данные не восстановить (кроме как из бэкапа).
            </div>
            <div style={{ color: T.inkMuted, fontSize: 12, marginBottom: 6 }}>
              Для подтверждения введи логин <code style={{ color: T.ink }}>{user.login}</code>:
            </div>
            <input
              autoFocus value={typed} onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder={user.login}
              style={{ width: '100%', padding: '10px 13px', borderRadius: 10, fontSize: 14,
                       background: T.bg, border: `1px solid ${match ? '#f87171' : T.border}`,
                       color: T.ink, fontFamily: T.fontMono, outline: 'none', boxSizing: 'border-box' }}
            />
            {error && <div style={{ marginTop: 10, color: '#fca5a5', fontSize: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={onClose} disabled={busy}
                      style={{ padding: '9px 16px', borderRadius: 10, fontSize: 13, background: T.bg,
                               border: `1px solid ${T.border}`, color: T.inkSoft }}>
                Отмена
              </button>
              <button onClick={submit} disabled={!match || busy}
                      style={{ padding: '9px 16px', borderRadius: 10, fontSize: 13,
                               background: match ? 'rgba(248,113,113,0.18)' : T.bg,
                               border: `1px solid ${match ? 'rgba(248,113,113,0.6)' : T.border}`,
                               color: match ? '#f87171' : T.inkMuted,
                               cursor: match && !busy ? 'pointer' : 'default', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Удаляю…' : 'Удалить навсегда'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
