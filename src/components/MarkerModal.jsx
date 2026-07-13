import { useEffect, useState } from 'react';
import {
  ComposedChart, Line, ReferenceArea, ReferenceLine, Tooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { STATUS_COLORS, STATUS_LABELS, T } from '../theme.js';
import { formatNum, formatDate, fmtXMonthYear, fmt2 } from '../utils.js';
import { nearestWeight } from '../adapters.js';
import { usePrivacy, pStatus, MASK } from '../privacy.jsx';
import TelegramExportButton from './TelegramExportButton.jsx';

// Общая модалка маркера (Screens B и C). Полный график: линия значений +
// полоса референса + точки. Опц. оверлей веса (вторая ось Y) по nearest-date join.
export default function MarkerModal({ marker, weight, onClose }) {
  const priv = usePrivacy();
  const [showWeight, setShowWeight] = useState(false);

  // Escape закрывает модалку (правка №2) — чтобы не искать крестик.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const status = marker.status;
  const c = pStatus(priv, status);

  // Обе seq-точки идут в график (двойные значения показываем целиком).
  const data = marker.points
    .filter((p) => p.value != null)
    .map((p) => {
      const nw = weight ? nearestWeight(p.date, weight) : null;
      return { ts: p.ts, date: p.date, v: p.value, seq: p.seq, weight: nw ? nw.weight : null };
    });

  const values = data.map((d) => d.v);
  const dataMin = Math.min(...values, marker.refLow ?? Infinity);
  const dataMax = Math.max(...values, marker.refHigh ?? -Infinity);
  const pad = (dataMax - dataMin) * 0.12 || Math.abs(dataMax) * 0.1 || 1;
  const yMin = Math.max(0, dataMin - pad);
  const yMax = dataMax + pad;

  const weights = data.map((d) => d.weight).filter((w) => w != null);
  const wMin = weights.length ? Math.min(...weights) : 0;
  const wMax = weights.length ? Math.max(...weights) : 1;

  const hasBand = marker.refLow != null && marker.refHigh != null;
  const hasCap = marker.refLow == null && marker.refHigh != null;
  const hasFloor = marker.refLow != null && marker.refHigh == null;

  return (
    <div
      className="animate-fadeIn"
      style={{
        position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(4,4,14,0.72)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="animate-slideUp"
        style={{
          width: '100%', maxWidth: 680, borderRadius: 16, overflow: 'hidden',
          background: T.card, border: `1px solid ${c.border}`,
          maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: 20, borderBottom: `1px solid ${T.borderSoft}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: T.inkMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>
                {marker.unit || '—'} · норма {priv ? MASK : marker.refRaw || '—'}
              </div>
              <div style={{ fontFamily: T.fontDisplay, color: T.ink, fontWeight: 500, fontSize: 24, lineHeight: 1.15 }}>
                {marker.name_ru}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                fontSize: 13, padding: '6px 12px', borderRadius: 999,
                background: T.cardHover, color: T.inkSoft, border: `1px solid ${T.border}`,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{ color: c.fg, fontFamily: T.fontMono, fontWeight: 500, fontSize: 44, letterSpacing: '-0.02em' }}>
              {priv ? MASK : marker.last?.value != null ? formatNum(marker.last.value) : marker.last?.valueText || '—'}
            </div>
            <div style={{ color: T.inkMuted, fontSize: 12 }}>
              {formatDate(marker.last?.date)}{priv ? '' : ` · ${STATUS_LABELS[status]}`}
            </div>
            {weight && data.some((d) => d.weight != null) && (
              <button
                onClick={() => setShowWeight((v) => !v)}
                style={{
                  marginLeft: 'auto', fontSize: 11, padding: '5px 10px', borderRadius: 6,
                  fontFamily: T.fontMono,
                  background: showWeight ? 'rgba(251,191,36,0.14)' : T.cardHover,
                  color: showWeight ? T.amber : T.inkSoft,
                  border: `1px solid ${showWeight ? 'rgba(251,191,36,0.4)' : T.border}`,
                }}
              >
                вес
              </button>
            )}
          </div>

          {/* Экспорт PDF в Telegram — наверху, чтобы легко найти (скрыт в приватном режиме) */}
          <div style={{ marginTop: 14 }}>
            <TelegramExportButton kind="analyte" id={marker.id} />
          </div>
        </div>

        {/* Chart */}
        <div style={{ padding: '16px 8px', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid stroke={T.borderSoft} strokeDasharray="2 4" vertical={false} />
              {hasBand && (
                <ReferenceArea
                  yAxisId="L"
                  y1={marker.refLow}
                  y2={marker.refHigh}
                  fill="rgba(52,211,153,0.06)"
                  fillOpacity={1}
                  stroke="rgba(52,211,153,0.20)"
                  strokeDasharray="3 3"
                />
              )}
              {hasCap && (
                <ReferenceLine
                  yAxisId="L"
                  y={marker.refHigh}
                  stroke="rgba(52,211,153,0.4)"
                  strokeDasharray="3 3"
                  label={priv ? undefined : { value: `≤ ${marker.refHigh}`, position: 'right', fill: T.inkMuted, fontSize: 10 }}
                />
              )}
              {hasFloor && (
                <ReferenceLine
                  yAxisId="L"
                  y={marker.refLow}
                  stroke="rgba(52,211,153,0.4)"
                  strokeDasharray="3 3"
                  label={priv ? undefined : { value: `≥ ${marker.refLow}`, position: 'right', fill: T.inkMuted, fontSize: 10 }}
                />
              )}
              <XAxis
                dataKey="ts"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={fmtXMonthYear}
                tick={{ fill: T.inkMuted, fontSize: 10, fontFamily: T.fontMono }}
                stroke={T.border}
                tickLine={false}
              />
              <YAxis
                yAxisId="L"
                domain={[yMin, yMax]}
                tickFormatter={fmt2}
                tick={priv ? false : { fill: T.inkMuted, fontSize: 10, fontFamily: T.fontMono }}
                stroke={T.border}
                tickLine={false}
                width={38}
              />
              {showWeight && (
                <YAxis
                  yAxisId="R"
                  orientation="right"
                  domain={[Math.floor(wMin - 2), Math.ceil(wMax + 2)]}
                  tickFormatter={fmt2}
                  tick={priv ? false : { fill: T.amber, fontSize: 10, fontFamily: T.fontMono }}
                  stroke={T.amber}
                  tickLine={false}
                  width={36}
                />
              )}
              {!priv && (
                <Tooltip
                  contentStyle={{
                    background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6,
                    fontFamily: T.fontMono, fontSize: 11, color: T.ink,
                  }}
                  labelFormatter={(ts) => formatDate(new Date(ts).toISOString().slice(0, 10))}
                  formatter={(v, name) =>
                    name === 'Вес' ? [`${fmt2(v)} кг`, 'Вес'] : [`${fmt2(v)} ${marker.unit || ''}`.trim(), marker.name_ru]
                  }
                />
              )}
              <Line
                yAxisId="L"
                type="monotone"
                dataKey="v"
                name="Маркер"
                stroke={c.fg}
                strokeWidth={1.8}
                dot={{ r: 2.6, fill: c.fg, stroke: 'none' }}
                activeDot={{ r: 4.5, fill: c.fg, stroke: T.bg, strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls
              />
              {showWeight && (
                <Line
                  yAxisId="R"
                  type="monotone"
                  dataKey="weight"
                  name="Вес"
                  stroke={T.amber}
                  strokeWidth={1.4}
                  strokeDasharray="4 3"
                  strokeOpacity={0.7}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Recent values */}
        <div style={{ padding: 20, borderTop: `1px solid ${T.borderSoft}` }}>
          <div style={{ color: T.inkMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 8 }}>
            последние замеры
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {marker.points
              .filter((p) => p.value != null || p.valueText)
              .slice(-8)
              .reverse()
              .map((p, i) => {
                const s = p.value != null ? c : STATUS_COLORS.none;
                return (
                  <div
                    key={`${p.date}-${p.seq}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 8px', borderRadius: 6,
                      background: i === 0 ? T.cardHover : 'transparent',
                    }}
                  >
                    <span style={{ color: T.inkSoft, fontFamily: T.fontMono, fontSize: 12 }}>
                      {formatDate(p.date)}{p.seq > 0 ? ` · #${p.seq}` : ''}
                    </span>
                    <span style={{ color: s.fg, fontFamily: T.fontMono, fontSize: 13, fontWeight: 500 }}>
                      {priv ? MASK : p.value != null ? formatNum(p.value) : p.valueText}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
