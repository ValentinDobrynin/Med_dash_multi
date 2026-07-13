import { useEffect, useRef, useState } from 'react';
import { STATUS_COLORS, T } from '../theme.js';
import { exportToTelegram, reportDownloadUrl } from '../api.js';
import { usePrivacy } from '../privacy.jsx';
import { useMe } from '../me.jsx';

// Экспорт PDF-отчёта (PLAN_multiuser v3 §5.5): скачивание в браузере — всегда;
// отправка в Telegram — только при подключённом и привязанном боте юзера.
// Один компонент для окна маркера (kind='analyte') и шапки категории (kind='panel').
// Скрыт в приватном режиме: не отправить/не скачать PDF с реальными значениями,
// показывая дэш кому-то.
export default function TelegramExportButton({ kind, id, style }) {
  const priv = usePrivacy();
  const me = useMe();
  const [state, setState] = useState('idle'); // idle | sending | success | error
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (priv) return null;

  const botReady = Boolean(me?.bot?.bound);

  const onTelegram = async () => {
    if (state === 'sending') return;
    clearTimeout(timer.current);
    setState('sending');
    try {
      await exportToTelegram(kind, id);
      setState('success');
      timer.current = setTimeout(() => setState('idle'), 3000);
    } catch {
      setState('error');
      timer.current = setTimeout(() => setState('idle'), 4000);
    }
  };

  const tgLabel =
    state === 'sending' ? 'отправляю…'
    : state === 'success' ? '✓ отправлено в Telegram'
    : state === 'error' ? '✕ не удалось'
    : '✈ В Telegram';

  const c =
    state === 'success' ? STATUS_COLORS.ok
    : state === 'error' ? STATUS_COLORS.alert
    : { fg: T.accent, bg: 'rgba(129,140,248,0.14)', border: T.accent };

  const pill = (fg, bg, border) => ({
    display: 'inline-flex', alignItems: 'center', gap: 8,
    fontSize: 13, padding: '9px 16px', borderRadius: 999,
    fontFamily: T.fontBody, fontWeight: 500, whiteSpace: 'nowrap',
    color: fg, background: bg, border: `1px solid ${border}`,
    textDecoration: 'none', cursor: 'pointer',
  });

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, ...style }}>
      <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
        {/* Скачивание файлом — работает без бота (§5.5) */}
        <a href={reportDownloadUrl(kind, id)} className="tap"
           style={pill(T.accent, 'rgba(129,140,248,0.14)', T.accent)}>
          ⤓ Скачать PDF
        </a>
        {botReady && (
          <button onClick={onTelegram} disabled={state === 'sending'} className="tap"
                  style={{ ...pill(c.fg, c.bg, c.border), opacity: state === 'sending' ? 0.7 : 1 }}>
            {tgLabel}
          </button>
        )}
      </div>
      {state === 'error' && (
        <span style={{ color: T.inkMuted, fontSize: 10 }}>
          проверьте связь с ботом и повторите
        </span>
      )}
    </div>
  );
}
