import { useMemo, useState } from 'react';
import { STATUS_COLORS, STATUS_LABELS, T } from '../theme.js';
import { buildMarkers, buildPanels, statusTotals } from '../adapters.js';
import { formatNum } from '../utils.js';
import { usePrivacy, pStatus, MASK } from '../privacy.jsx';
import GroupCard from '../components/GroupCard.jsx';
import CategoryView from '../components/CategoryView.jsx';
import MarkerCard from '../components/MarkerCard.jsx';
import MarkerModal from '../components/MarkerModal.jsx';

// Русское склонение слова «анализ» по числу (1 анализ / 2 анализа / 5 анализов).
function plural(n) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return 'анализов';
  if (b > 1 && b < 5) return 'анализа';
  if (b === 1) return 'анализ';
  return 'анализов';
}

// Screens A + B: Browse (обзор групп) → Category, + дрилл в отклонения.
export default function LabsScreen({ data }) {
  const priv = usePrivacy();
  const { markersMap, panels, totals } = useMemo(() => {
    const mm = buildMarkers(data.labs, data.dictionary);
    return { markersMap: mm, panels: buildPanels(mm), totals: statusTotals(mm) };
  }, [data]);

  const [selectedPanel, setSelectedPanel] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false); // правка №14: спец-«категория отклонений»
  const [filter, setFilter] = useState(null); // null | alert | warn | ok
  const [query, setQuery] = useState('');
  const [openMarker, setOpenMarker] = useState(null);

  // Поиск по названию — плоский список маркеров.
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return Object.values(markersMap)
      .filter((m) => m.name_ru.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      .sort((a, b) => a.name_ru.localeCompare(b.name_ru, 'ru'));
  }, [query, markersMap]);

  // В приватном режиме фильтрация по статусу отключена (иначе видно, какие группы вне нормы).
  const activeFilter = priv ? null : filter;

  // Фильтр по статусу применяется к списку групп (оставляем группы, где есть такой статус).
  const visiblePanels = useMemo(() => {
    if (!activeFilter) return panels;
    const filter = activeFilter;
    return panels
      .map((p) => ({ ...p, markers: p.markers.filter((m) => m.status === filter) }))
      .filter((p) => p.markers.length > 0)
      .map((p) => ({ ...p, hot: p.markers.filter((m) => m.status === 'alert' || m.status === 'warn').slice(0, 3).map((m) => ({ name: m.name_ru, status: m.status, value: m.last?.value })) }));
  }, [activeFilter, panels]);

  const alertMarkers = useMemo(
    () => Object.values(markersMap).filter((m) => m.status === 'alert').sort((a, b) => a.name_ru.localeCompare(b.name_ru, 'ru')),
    [markersMap]
  );

  // Дрилл в категорию.
  if (selectedPanel) {
    const fresh = panels.find((p) => p.id === selectedPanel.id) || selectedPanel;
    return <CategoryView panel={fresh} weight={data.weight} onBack={() => setSelectedPanel(null)} />;
  }

  // Дрилл в спец-«категорию отклонений» (правка №14). В приватном режиме недоступен.
  if (showAlerts && !priv) {
    return (
      <section className="animate-fadeIn">
        <button
          onClick={() => setShowAlerts(false)}
          className="tap"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18,
            fontSize: 15, color: T.accent, background: 'rgba(129,140,248,0.14)', border: `1px solid ${T.accent}`,
            padding: '14px 48px', borderRadius: 999, fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>←</span> Назад к группам
        </button>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontStyle: 'italic', color: priv ? T.ink : STATUS_COLORS.alert.fg, fontSize: 24, margin: 0 }}>
            Сейчас вне нормы
          </h2>
          <div style={{ color: T.inkMuted, fontFamily: T.fontMono, fontSize: 11, marginTop: 4 }}>
            {priv ? MASK : alertMarkers.length} маркеров
          </div>
        </div>
        {alertMarkers.length === 0 ? (
          <div style={{ color: T.inkMuted, fontSize: 13, padding: 16 }}>Отклонений нет.</div>
        ) : (
          <div className="marker-grid">
            {alertMarkers.map((m) => (
              <MarkerCard key={m.id} marker={m} onTap={setOpenMarker} />
            ))}
          </div>
        )}
        {openMarker && <MarkerModal marker={openMarker} weight={data.weight} onClose={() => setOpenMarker(null)} />}
      </section>
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* Поиск */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 поиск по названию маркера…"
        style={{
          width: '100%', padding: '11px 14px', borderRadius: 10, marginBottom: 16,
          background: T.card, border: `1px solid ${T.border}`, color: T.ink,
          fontSize: 14, outline: 'none',
        }}
      />

      {/* Status pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { status: 'alert', count: totals.alert },
          { status: 'warn', count: totals.warn },
          { status: 'ok', count: totals.ok },
        ].map(({ status, count }) => {
          const c = pStatus(priv, status);
          const active = activeFilter === status;
          return (
            <button
              key={status}
              onClick={() => !priv && setFilter((f) => (f === status ? null : status))}
              className="tap"
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, display: 'flex', alignItems: 'baseline', gap: 8,
                background: active ? c.fg + '26' : c.bg,
                border: `1px solid ${active ? c.fg : c.border}`,
                boxShadow: active && !priv ? `0 4px 12px -4px ${c.fg}55` : 'none',
                cursor: priv ? 'default' : 'pointer',
                transition: 'all 0.18s',
              }}
            >
              <span style={{ color: c.fg, fontFamily: T.fontMono, fontWeight: 500, fontSize: 20, lineHeight: 1 }}>{priv ? MASK : count}</span>
              <span style={{ color: active ? c.fg : T.inkMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {STATUS_LABELS[status]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Явный сброс активного фильтра (правка №3): понятно, что фильтр включён и как его снять. */}
      {activeFilter && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <span style={{ color: T.inkMuted, fontSize: 12 }}>
            Показаны только: <span style={{ color: pStatus(priv, filter).fg, fontFamily: T.fontMono }}>«{STATUS_LABELS[filter]}»</span>
          </span>
          <button
            onClick={() => setFilter(null)}
            className="tap"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999,
              background: 'rgba(129,140,248,0.14)', border: `1px solid ${T.accent}`, color: T.accent,
              fontSize: 13, fontFamily: T.fontBody,
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>✕</span> сбросить фильтр
          </button>
        </div>
      )}

      {/* Крупный блок «все анализы вне нормы» — скрыт в приватном режиме (сам факт = утечка) */}
      {alertMarkers.length > 0 && !query && !priv && (
        <button
          onClick={() => setShowAlerts(true)}
          className="tap"
          style={{
            width: '100%', textAlign: 'left', marginBottom: 16, padding: '22px 22px', borderRadius: 16,
            display: 'flex', alignItems: 'center', gap: 18,
            background: priv ? T.card : STATUS_COLORS.alert.bg,
            border: `1px solid ${priv ? T.border : STATUS_COLORS.alert.border}`,
          }}
        >
          <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 56 }}>
            <div style={{ color: pStatus(priv, 'alert').fg, fontFamily: T.fontMono, fontSize: 44, fontWeight: 600, lineHeight: 1 }}>
              {priv ? MASK : alertMarkers.length}
            </div>
            <div style={{ color: T.inkMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>вне нормы</div>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: T.ink, fontFamily: T.fontDisplay, fontSize: 19, fontWeight: 500, lineHeight: 1.2, marginBottom: 6 }}>
              Показать все {priv ? MASK : alertMarkers.length} {plural(alertMarkers.length)} вне нормы — списком →
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
              {alertMarkers.slice(0, 6).map((m) => (
                <span key={m.id} style={{ fontFamily: T.fontMono, fontSize: 11, color: T.inkSoft }}>
                  <span style={{ color: T.ink }}>{m.name_ru}</span> {priv ? '' : formatNum(m.last?.value)}
                </span>
              ))}
              {alertMarkers.length > 6 && <span style={{ color: T.inkMuted, fontSize: 11 }}>+{alertMarkers.length - 6}</span>}
            </div>
          </div>
          <span style={{ color: pStatus(priv, 'alert').fg, fontSize: 26, flexShrink: 0 }}>›</span>
        </button>
      )}

      {/* Поиск: плоский список */}
      {searchResults ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {searchResults.length === 0 && (
            <div style={{ color: T.inkMuted, fontSize: 13, padding: 16, textAlign: 'center' }}>Ничего не найдено.</div>
          )}
          {searchResults.map((m) => {
            const c = pStatus(priv, m.status);
            return (
              <button
                key={m.id}
                onClick={() => setOpenMarker(m)}
                className="tap"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left',
                  padding: '11px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.border}`,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: T.ink, fontFamily: T.fontMono, fontSize: 13 }}>{m.name_ru}</div>
                  <div style={{ color: T.inkMuted, fontSize: 10 }}>{m.unit}</div>
                </div>
                <span style={{ color: c.fg, fontFamily: T.fontMono, fontSize: 15, fontWeight: 500, flexShrink: 0 }}>
                  {priv ? MASK : m.last?.value != null ? formatNum(m.last.value) : m.last?.valueText || '—'}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* Сетка плиток групп (правки №1, №11) */
        <>
          <div className="group-grid">
            {visiblePanels.map((p) => (
              <GroupCard key={p.id} panel={p} onOpen={setSelectedPanel} />
            ))}
          </div>
          {visiblePanels.length === 0 && (
            <div style={{ color: T.inkMuted, fontSize: 13, padding: 16, textAlign: 'center' }}>
              Нет групп с выбранным статусом.
            </div>
          )}
        </>
      )}

      {openMarker && <MarkerModal marker={openMarker} weight={data.weight} onClose={() => setOpenMarker(null)} />}
    </div>
  );
}
