import { useMemo, useState } from 'react';
import { T } from '../theme.js';
import { login, registerUser, resetPassword } from '../api.js';

// Экран входа/регистрации/сброса (PLAN_multiuser v3 §6.1–6.2).
// URL ?code=… → регистрация по инвайту; ?reset=… → сброс пароля.
export default function AuthScreen({ onAuthed }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const inviteCode = params.get('code') || '';
  const resetCode = params.get('reset') || '';
  const [mode, setMode] = useState(resetCode ? 'reset' : inviteCode ? 'register' : 'login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    login: '', password: '', name: '', consent: false,
    code: inviteCode, reset: resetCode, password2: '',
  });
  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.login.trim(), form.password);
      } else if (mode === 'register') {
        if (form.password !== form.password2) throw new Error('пароли не совпадают');
        await registerUser({
          code: form.code.trim(), login: form.login.trim(), name: form.name.trim(),
          password: form.password, consent: form.consent,
        });
      } else {
        if (form.password !== form.password2) throw new Error('пароли не совпадают');
        await resetPassword(form.reset.trim(), form.password);
      }
      window.history.replaceState({}, '', window.location.pathname); // подчистить ?code
      onAuthed();
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setBusy(false);
    }
  };

  const input = {
    width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
    background: T.card, border: `1px solid ${T.border}`, color: T.ink,
    fontFamily: T.fontBody, outline: 'none', boxSizing: 'border-box',
  };
  const label = { color: T.inkMuted, fontSize: 11, fontFamily: T.fontMono, marginBottom: 5, display: 'block' };

  return (
    <div className="container" style={{ maxWidth: 460, paddingTop: 48 }}>
      <div style={{ color: T.inkMuted, fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 6 }}>
        Здоровье · панель
      </div>
      <h1 style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontStyle: 'italic', color: T.ink, fontSize: 30, margin: '0 0 22px' }}>
        {mode === 'login' ? 'Вход' : mode === 'register' ? 'Регистрация' : 'Новый пароль'}
      </h1>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {mode === 'register' && (
          <>
            <div>
              <span style={label}>инвайт-код</span>
              <input style={input} value={form.code} onChange={set('code')} required />
            </div>
            <div>
              <span style={label}>имя</span>
              <input style={input} value={form.name} onChange={set('name')} required />
            </div>
          </>
        )}
        {mode === 'reset' && (
          <div>
            <span style={label}>reset-код (от администратора)</span>
            <input style={input} value={form.reset} onChange={set('reset')} required />
          </div>
        )}
        {mode !== 'reset' && (
          <div>
            <span style={label}>логин</span>
            <input style={input} value={form.login} onChange={set('login')}
                   autoComplete="username" required />
          </div>
        )}
        <div>
          <span style={label}>{mode === 'login' ? 'пароль' : 'новый пароль (мин. 8 символов)'}</span>
          <input style={input} type="password" value={form.password} onChange={set('password')}
                 autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                 minLength={mode === 'login' ? undefined : 8} required />
        </div>
        {mode !== 'login' && (
          <div>
            <span style={label}>повтори пароль</span>
            <input style={input} type="password" value={form.password2} onChange={set('password2')} required />
          </div>
        )}

        {mode === 'register' && (
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>
            <input type="checkbox" checked={form.consent} onChange={set('consent')} required
                   style={{ marginTop: 3 }} />
            <span>
              Понимаю и согласен: сервис <b>не является медицинским</b> и не заменяет врача;
              администратор имеет технический доступ к данным при разборе ошибок;
              нераспознанные PDF могут обрабатываться внешним AI-сервисом для извлечения значений;
              данные можно в любой момент выгрузить и полностью удалить.
            </span>
          </label>
        )}

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13,
                        background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={busy} className="tap"
                style={{ padding: '12px 22px', borderRadius: 10, fontSize: 15, fontWeight: 500,
                         background: 'rgba(129,140,248,0.16)', border: `1px solid ${T.accent}`,
                         color: T.accent, opacity: busy ? 0.6 : 1 }}>
          {busy ? '…' : mode === 'login' ? 'Войти' : mode === 'register' ? 'Создать аккаунт' : 'Сменить пароль'}
        </button>
      </form>

      <div style={{ marginTop: 18, fontSize: 12, color: T.inkMuted, display: 'flex', gap: 14 }}>
        {mode !== 'login' && (
          <button onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: T.accent, textDecoration: 'underline', fontSize: 12 }}>
            у меня есть аккаунт
          </button>
        )}
        {mode === 'login' && (
          <>
            <button onClick={() => setMode('register')} style={{ background: 'none', border: 'none', color: T.accent, textDecoration: 'underline', fontSize: 12 }}>
              регистрация по инвайту
            </button>
            <button onClick={() => setMode('reset')} style={{ background: 'none', border: 'none', color: T.inkMuted, textDecoration: 'underline', fontSize: 12 }}>
              забыл пароль
            </button>
          </>
        )}
      </div>
      {mode === 'reset' && (
        <div style={{ marginTop: 10, fontSize: 12, color: T.inkMuted, lineHeight: 1.5 }}>
          Reset-код выдаёт администратор — напиши ему, получи код и введи здесь.
        </div>
      )}
    </div>
  );
}
