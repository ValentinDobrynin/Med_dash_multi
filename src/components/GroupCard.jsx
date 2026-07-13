import { STATUS_COLORS, STATUS_LABELS, T } from '../theme.js';
import { usePrivacy, pStatus } from '../privacy.jsx';

// Плитка группы (Screen A, правки №11 + №1): заголовок, число маркеров,
// счётчики статусов, 1–3 горячих отклонения. Клик → категория.
export default function GroupCard({ panel, onOpen }) {
  const priv = usePrivacy();
  const { counts, hot } = panel;
  const hasHot = hot.length > 0;

  const railColor = priv
    ? STATUS_COLORS.none.fg
    : counts.alert
    ? STATUS_COLORS.alert.fg
    : counts.warn
    ? STATUS_COLORS.warn.fg
    : STATUS_COLORS.ok.fg;

  return (
    <button
      onClick={() => onOpen(panel)}
      className="tap"
      style={{
        display: 'flex', flexDirection: 'column', gap: 10, width: '100%', textAlign: 'left',
        padding: '16px 16px 14px', borderRadius: 14, background: T.card,
        border: `1px solid ${T.border}`, borderTop: `2px solid ${railColor}`, transition: 'filter 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.12)')}
      onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
    >
      {/* Заголовок + число маркеров */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: T.ink, fontFamily: T.fontDisplay, fontSize: 17, fontWeight: 500, lineHeight: 1.15 }}>
          {panel.name_ru}
        </span>
        <span style={{ color: T.inkMuted, fontFamily: T.fontMono, fontSize: 12, flexShrink: 0 }}>{panel.markers.length}</span>
      </div>

      {/* Счётчики статусов — в приватном режиме скрыты (не раскрываем, сколько вне нормы) */}
      {priv ? (
        <div style={{ fontSize: 11, color: T.inkMuted, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>·</span> скрыто
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { k: 'alert', n: counts.alert },
              { k: 'warn', n: counts.warn },
              { k: 'ok', n: counts.ok },
            ].filter((s) => s.n > 0).map((s) => {
              const c = STATUS_COLORS[s.k];
              return (
                <span
                  key={s.k}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999,
                    background: c.bg, border: `1px solid ${c.border}`, fontSize: 10, fontFamily: T.fontMono, color: c.fg,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{s.n}</span>
                  <span style={{ color: c.fg, opacity: 0.85 }}>{STATUS_LABELS[s.k]}</span>
                </span>
              );
            })}
          </div>

          {/* Горячие отклонения (1–3) — только имена вне приватного режима */}
          {hasHot ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {hot.map((h, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.inkSoft }}>
                  <span style={{ width: 6, height: 6, borderRadius: 6, background: STATUS_COLORS[h.status].fg, flexShrink: 0 }} />
                  <span style={{ fontFamily: T.fontMono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: STATUS_COLORS.ok.fg, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>✓</span> всё в норме
            </div>
          )}
        </>
      )}
    </button>
  );
}
