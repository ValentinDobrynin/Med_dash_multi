import { useMemo, useState } from 'react';
import {
  ComposedChart, Line, Scatter, ScatterChart, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine,
} from 'recharts';
import { T } from '../theme.js';
import { buildMarkers, joinSeries, pearson, quantitativeMarkers } from '../adapters.js';
import { toNum, fmtYear, fmtDateShort, formatNum, formatDate, fmt2 } from '../utils.js';
import { usePrivacy, MASK } from '../privacy.jsx';

// Разумное окно для включения точки в scatter (ТЗ §3.2).
const MAX_JOIN_DAYS = 120;

// Спец-id ряда «Вес» — не маркер, идёт из data.weight.
const WEIGHT_ID = 'weight';

// Цвета рядов: вес всегда янтарный; маркеры — по роли (A холодный циан, B индиго).
// Дефолт (A=Вес, B=LDL) → амбер + индиго = как было раньше.
function seriesColor(id, role) {
  if (id === WEIGHT_ID) return T.amber;
  return role === 'A' ? '#22d3ee' : T.accent;
}

// Устойчивый min/max: игнорирует NaN/нечисла, без spread (безопасно на больших рядах).
function finiteMinMax(arr) {
  let min = Infinity;
  let max = -Infinity;
  let any = false;
  for (const v of arr) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      any = true;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return any ? { min, max } : null;
}

// Домен оси по точкам ряда (устойчив к пустому/односерийному ряду).
function seriesDomain(points) {
  const st = finiteMinMax(points.map((p) => p.value));
  if (!st) return [0, 1];
  if (st.min === st.max) {
    const v = st.min;
    return v === 0 ? [-1, 1] : [Math.min(v * 0.9, v * 1.1), Math.max(v * 0.9, v * 1.1)];
  }
  const pad = (st.max - st.min) * 0.08;
  return [st.min - pad, st.max + pad];
}

// Унифицированный ряд {id, name, unit, color, dense, points:[{ts,date,value}]}.
function buildSeries(id, role, weightPts, markersMap) {
  const color = seriesColor(id, role);
  if (id === WEIGHT_ID) {
    return {
      id: WEIGHT_ID, name: 'Вес', unit: 'кг', color, dense: true,
      points: weightPts.map((w) => ({ ts: w.ts, date: w.date, value: w.weight })),
    };
  }
  const m = markersMap[id];
  if (!m) return { id, name: id, unit: '', color, dense: false, points: [] };
  const points = m.points
    .filter((p) => p.value != null)
    .map((p) => ({ ts: p.ts, date: p.date, value: p.value }));
  return { id, name: m.name_ru, unit: m.unit || '', color, dense: false, points };
}

// Вехи (опц. вертикальные линии): старт активной фазы. yAxisId обязателен (иначе recharts падает).
const MILESTONES = [{ date: '2026-02-01', label: 'старт Cycle IV' }];

// Screen C — Динамика и связки: два выбираемых ряда A/B + scatter r.
export default function WeightScreen({ data }) {
  const priv = usePrivacy();
  const markersMap = useMemo(() => buildMarkers(data.labs, data.dictionary), [data]);
  const quantMarkers = useMemo(() => quantitativeMarkers(markersMap), [markersMap]);

  // Единый список вариантов: [Вес] + все quantitative-маркеры.
  const seriesOptions = useMemo(
    () => [{ id: WEIGHT_ID, label: 'Вес' }, ...quantMarkers.map((m) => ({ id: m.id, label: m.name_ru }))],
    [quantMarkers]
  );

  // Точки веса (все, по возрастанию). Отбрасываем невалидные даты/веса, чтобы NaN
  // не протёк в домены осей recharts (иначе крах графика).
  const weightPts = useMemo(
    () =>
      (data.weight || [])
        .map((w) => ({ ts: toNum(w.measure_date), date: w.measure_date, weight: Number(w.weight_kg) }))
        .filter((w) => Number.isFinite(w.ts) && Number.isFinite(w.weight))
        .sort((a, b) => a.ts - b.ts),
    [data.weight]
  );

  // Дефолт: A = Вес, B = LDL (или первый маркер, если LDL нет).
  const defaultBId = quantMarkers.find((m) => /ldl/i.test(m.id))?.id || quantMarkers[0]?.id || WEIGHT_ID;
  const [aId, setAId] = useState(WEIGHT_ID);
  const [bId, setBId] = useState(defaultBId);

  const seriesA = useMemo(() => buildSeries(aId, 'A', weightPts, markersMap), [aId, weightPts, markersMap]);
  const seriesB = useMemo(() => buildSeries(bId, 'B', weightPts, markersMap), [bId, weightPts, markersMap]);
  const sameSeries = aId === bId;

  // Биоимпеданс на линии веса — только если один из рядов = Вес (привязка к весовой оси).
  const bioDots = useMemo(() => {
    const weightIsA = aId === WEIGHT_ID;
    const weightIsB = bId === WEIGHT_ID;
    if (!weightIsA && !weightIsB) return [];
    const m = markersMap['bia_weight'];
    if (!m) return [];
    const yAxisId = weightIsA ? 'A' : 'B';
    return m.points.filter((p) => p.value != null).map((p) => ({ ts: p.ts, weight: p.value, yAxisId }));
  }, [aId, bId, markersMap]);

  // combined data для ComposedChart: union ts обоих рядов (a → ось A, b → ось B).
  const combined = useMemo(() => {
    const map = new Map();
    seriesA.points.forEach((p) => {
      const e = map.get(p.ts) || { ts: p.ts };
      e.a = p.value;
      map.set(p.ts, e);
    });
    seriesB.points.forEach((p) => {
      const e = map.get(p.ts) || { ts: p.ts };
      e.b = p.value;
      map.set(p.ts, e);
    });
    return [...map.values()].sort((x, y) => x.ts - y.ts);
  }, [seriesA, seriesB]);

  const aDomain = seriesDomain(seriesA.points);
  const bDomain = seriesDomain(seriesB.points);

  // X-домен по union ts обоих рядов.
  const allTs = combined.map((c) => c.ts);
  const tsStats = finiteMinMax(allTs);
  const xMin = tsStats ? tsStats.min : toNum('2014-01-01');
  const xMax = tsStats ? tsStats.max : toNum('2026-07-01');
  const yearTicks = [];
  {
    const y0 = new Date(xMin).getFullYear();
    const y1 = new Date(xMax).getFullYear();
    if (Number.isFinite(y0) && Number.isFinite(y1) && y1 >= y0 && y1 - y0 < 100) {
      for (let y = y0; y <= y1; y++) yearTicks.push(toNum(`${y}-01-01`));
    }
  }

  // Scatter A↔B по обобщённому nearest-date join (идём по разреженному ряду).
  const scatter = useMemo(() => {
    const pairs = joinSeries(seriesA, seriesB, MAX_JOIN_DAYS);
    const r = pearson(pairs.map((p) => [p.a, p.b]));
    return { pairs, r };
  }, [seriesA, seriesB]);

  const rColor = Number.isNaN(scatter.r) ? T.inkMuted : Math.abs(scatter.r) > 0.6 ? '#f87171' : Math.abs(scatter.r) > 0.3 ? T.amber : '#34d399';
  const rLabel = Number.isNaN(scatter.r) ? '—' : Math.abs(scatter.r) > 0.6 ? 'сильная' : Math.abs(scatter.r) > 0.3 ? 'умеренная' : 'слабая';

  // Сводка по весу (профильный контекст, независим от выбора рядов).
  const wStats = finiteMinMax(weightPts.map((w) => w.weight));
  const cur = weightPts.length ? weightPts[weightPts.length - 1] : null;
  const peak = wStats ? wStats.max : null;
  const trough = wStats ? wStats.min : null;

  // Стиль линии: плотный ряд — сплошной без точек; разреженный — пунктир с точками.
  const lineProps = (s, yAxisId, dataKey) =>
    s.dense
      ? { yAxisId, dataKey, name: s.name, stroke: s.color, strokeWidth: 2, dot: false, isAnimationActive: false, connectNulls: true, type: 'monotone' }
      : { yAxisId, dataKey, name: s.name, stroke: s.color, strokeWidth: 1.6, strokeDasharray: '4 3', dot: { r: 2.5, fill: s.color, stroke: 'none' }, isAnimationActive: false, connectNulls: true, type: 'monotone' };

  return (
    <div className="animate-fadeIn">
      {/* Сводка по весу */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard label="Текущий вес" value={priv ? MASK : cur ? formatNum(cur.weight) : '—'} unit="кг" sub={cur ? formatDate(cur.date) : ''} accent />
        <StatCard label="Пик" value={priv ? MASK : peak != null ? formatNum(peak) : '—'} unit="кг" sub="максимум в ряду" />
        <StatCard label="Минимум" value={priv ? MASK : trough != null ? formatNum(trough) : '—'} unit="кг" sub="минимум в ряду" />
        <StatCard label="Точек веса" value={String(weightPts.length)} unit="" sub="в базе" />
      </div>

      {/* Динамика двух рядов */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <h2 style={{ fontFamily: T.fontDisplay, fontWeight: 500, color: T.ink, fontSize: 18, margin: 0 }}>Динамика: два ряда</h2>
          <div style={{ color: T.inkMuted, fontFamily: T.fontMono, fontSize: 11 }}>ряд A — левая ось · ряд B — правая ось</div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '10px 0 14px' }}>
          <SeriesPicker label="Ряд A" color={seriesA.color} value={aId} options={seriesOptions} onChange={setAId} />
          <SeriesPicker label="Ряд B" color={seriesB.color} value={bId} options={seriesOptions} onChange={setBId} />
        </div>

        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={combined} margin={{ top: 20, right: 16, left: 0, bottom: 10 }}>
            <CartesianGrid stroke={T.borderSoft} strokeDasharray="2 4" vertical={false} />
            {MILESTONES.map((ms, i) => (
              <ReferenceLine
                key={`ms-${i}`}
                yAxisId="A"
                x={toNum(ms.date)}
                stroke={T.accent}
                strokeWidth={1.4}
                strokeDasharray="4 3"
                label={{ value: `▸ ${ms.label}`, position: 'insideTopRight', fill: T.accent, fontSize: 10, fontFamily: T.fontMono }}
              />
            ))}
            <XAxis
              dataKey="ts"
              type="number"
              domain={[xMin, xMax]}
              ticks={yearTicks}
              tickFormatter={fmtYear}
              stroke={T.border}
              tick={{ fill: T.inkMuted, fontSize: 11, fontFamily: T.fontMono }}
            />
            <YAxis
              yAxisId="A"
              domain={aDomain}
              tickFormatter={fmt2}
              stroke={seriesA.color}
              tick={priv ? false : { fill: seriesA.color, fontSize: 11, fontFamily: T.fontMono }}
              width={44}
            />
            <YAxis
              yAxisId="B"
              orientation="right"
              domain={bDomain}
              tickFormatter={fmt2}
              stroke={seriesB.color}
              tick={priv ? false : { fill: seriesB.color, fontSize: 11, fontFamily: T.fontMono }}
              width={44}
            />
            {!priv && (
              <Tooltip
                contentStyle={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: T.fontMono, fontSize: 11, color: T.ink }}
                labelFormatter={(ts) => fmtDateShort(ts)}
                formatter={(v, name, entry) => {
                  const s = entry && entry.dataKey === 'b' ? seriesB : seriesA;
                  return [`${fmt2(v)} ${s.unit}`.trim(), s.name];
                }}
              />
            )}
            <Line {...lineProps(seriesA, 'A', 'a')} />
            <Line {...lineProps(seriesB, 'B', 'b')} />
            {bioDots.map((b, i) => (
              <ReferenceDot key={`bio-${i}`} yAxisId={b.yAxisId} x={b.ts} y={b.weight} r={5} fill="#a78bfa" stroke={T.bg} strokeWidth={2} ifOverflow="hidden" />
            ))}
          </ComposedChart>
        </ResponsiveContainer>

        <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: T.inkMuted }}>
          <Legend color={seriesA.color} label={`A · ${seriesA.name}${seriesA.unit ? ` (${seriesA.unit})` : ''}`} dashed={!seriesA.dense} />
          <Legend color={seriesB.color} label={`B · ${seriesB.name}${seriesB.unit ? ` (${seriesB.unit})` : ''}`} dashed={!seriesB.dense} />
          {bioDots.length > 0 && <Legend color="#a78bfa" label="биоимпеданс" dot />}
        </div>
      </div>

      {/* Scatter корреляция A↔B */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <div>
            <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 500, color: T.ink, fontSize: 16, margin: 0 }}>
              {seriesA.name} ↔ {seriesB.name}
            </h3>
            <p style={{ color: T.inkMuted, fontSize: 11, margin: '4px 0 0' }}>
              nearest-date join · точный ±3д, близкий ±30д, грубый {'>'}30д (полупрозрачно) · {scatter.pairs.length} пар
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: T.inkMuted, fontFamily: T.fontMono, fontSize: 12 }}>r = {Number.isNaN(scatter.r) ? '—' : scatter.r.toFixed(2)}</div>
            <div style={{ color: rColor, fontFamily: T.fontMono, fontSize: 12 }}>{rLabel}</div>
          </div>
        </div>

        {sameSeries ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: T.inkMuted, fontSize: 13 }}>
            Ряд A и ряд B совпадают ({seriesA.name}). Выберите разные ряды, чтобы увидеть связь.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 12, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid stroke={T.borderSoft} strokeDasharray="2 4" />
                <XAxis
                  type="number"
                  dataKey="a"
                  name={seriesA.name}
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={fmt2}
                  stroke={seriesA.color}
                  tick={priv ? false : { fill: T.inkMuted, fontSize: 10, fontFamily: T.fontMono }}
                  label={{ value: `${seriesA.name}${seriesA.unit ? `, ${seriesA.unit}` : ''}`, position: 'insideBottom', offset: -4, fill: T.inkMuted, fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="b"
                  name={seriesB.name}
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={fmt2}
                  stroke={seriesB.color}
                  tick={priv ? false : { fill: T.inkMuted, fontSize: 10, fontFamily: T.fontMono }}
                  width={44}
                />
                <ZAxis range={[50, 50]} />
                {!priv && (
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3', stroke: T.border }}
                    contentStyle={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: T.fontMono, fontSize: 11, color: T.ink }}
                    formatter={(v, name, entry) => {
                      const s = entry && entry.dataKey === 'b' ? seriesB : seriesA;
                      return [`${fmt2(v)} ${s.unit}`.trim(), s.name];
                    }}
                  />
                )}
                <Scatter name="точный" data={scatter.pairs.filter((p) => p.quality === 'exact')} fill={T.accent} fillOpacity={0.95} isAnimationActive={false} />
                <Scatter name="близкий" data={scatter.pairs.filter((p) => p.quality === 'close')} fill={T.accent} fillOpacity={0.6} isAnimationActive={false} />
                <Scatter name="грубый" data={scatter.pairs.filter((p) => p.quality === 'coarse')} fill={T.inkMuted} fillOpacity={0.5} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>

            <div style={{ marginTop: 10, fontSize: 11, color: T.inkMuted, lineHeight: 1.5 }}>
              |r| {'<'} 0.3 — слабая связь; 0.3–0.6 — умеренная; {'>'} 0.6 — сильная. Знак (+) растут вместе, (−) обратно.
              Пары без второго ряда в окне ±{MAX_JOIN_DAYS}д в scatter не включены.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SeriesPicker({ label, color, value, options, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 14, height: 3, borderRadius: 2, background: color, display: 'inline-block' }} />
      <label style={{ color: T.inkMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ background: T.bg, color: T.ink, border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 8px', fontFamily: T.fontMono, fontSize: 12 }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function StatCard({ label, value, unit, sub, accent }) {
  return (
    <div
      style={{
        borderRadius: 12, padding: 14,
        background: accent ? 'rgba(251,191,36,0.06)' : T.card,
        border: `1px solid ${accent ? 'rgba(251,191,36,0.3)' : T.border}`,
      }}
    >
      <div style={{ color: T.inkMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ color: accent ? T.amber : T.ink, fontFamily: T.fontMono, fontWeight: 600, fontSize: 26 }}>{value}</span>
        <span style={{ color: T.inkMuted, fontFamily: T.fontMono, fontSize: 12 }}>{unit}</span>
      </div>
      {sub && <div style={{ color: T.inkMuted, fontSize: 10, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Legend({ color, label, dashed, dot }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {dot ? (
        <span style={{ width: 8, height: 8, borderRadius: 8, background: color }} />
      ) : (
        <span style={{ width: 18, height: 0, borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
      )}
      <span style={{ color: T.inkSoft }}>{label}</span>
    </span>
  );
}
