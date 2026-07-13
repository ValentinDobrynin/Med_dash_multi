import { useState } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { STATUS_COLORS, T } from '../theme.js';
import { formatNum, formatDate, toNum, fmtYear, fmt2 } from '../utils.js';
import { computeStatus, snapshotMatrix } from '../adapters.js';
import { usePrivacy, pStatus, dispNum, dispText, MASK } from '../privacy.jsx';
import MarkerCard from './MarkerCard.jsx';
import MarkerModal from './MarkerModal.jsx';
import TelegramExportButton from './TelegramExportButton.jsx';

// Screen B — Категория. Контент зависит от kind панели.
export default function CategoryView({ panel, weight, onBack }) {
  const [openMarker, setOpenMarker] = useState(null);

  return (
    <section className="animate-fadeIn">
      {/* Возврат (правка №5): крупная заметная кнопка-пилюля (шире ×3, выше ×1.5) */}
      <button
        onClick={onBack}
        className="tap"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18,
          fontSize: 15, color: T.accent, background: 'rgba(129,140,248,0.14)', border: `1px solid ${T.accent}`,
          padding: '14px 48px', borderRadius: 999, fontFamily: T.fontBody, fontWeight: 500,
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>←</span> Назад к группам
      </button>

      <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontStyle: 'italic', color: T.ink, fontSize: 24, margin: 0 }}>
            {panel.name_ru}
          </h2>
          <div style={{ color: T.inkMuted, fontFamily: T.fontMono, fontSize: 11, marginTop: 4 }}>
            {panel.markers.length} маркеров
          </div>
        </div>
        {/* Экспорт всей панели PDF в Telegram (скрыт в приватном режиме) */}
        <TelegramExportButton kind="panel" id={panel.id} />
      </div>

      {panel.kind === 'trend' && (
        <div className="marker-grid">
          {panel.markers.map((m) => (
            <MarkerCard key={m.id} marker={m} onTap={setOpenMarker} />
          ))}
        </div>
      )}

      {panel.kind === 'serology' && <SerologyList markers={panel.markers} />}

      {panel.kind === 'reproduction' && <ReproductionView markers={panel.markers} onTap={setOpenMarker} />}

      {panel.kind === 'body' && <BodyComposition markers={panel.markers} weight={weight} onTap={setOpenMarker} />}

      {openMarker && <MarkerModal marker={openMarker} weight={weight} onClose={() => setOpenMarker(null)} />}
    </section>
  );
}

// Подзаголовок секции (единый стиль для репродукции и состава тела).
function SectionLabel({ children }) {
  return (
    <div style={{ color: T.inkMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', margin: '4px 0 10px' }}>
      {children}
    </div>
  );
}

// ── Серология (immune_infections): список «маркер: результат (дата)» ──
function SerologyList({ markers }) {
  const priv = usePrivacy();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {markers.map((m) => {
        const last = m.last;
        const raw = last?.valueText != null ? last.valueText : last?.value != null ? `${formatNum(last.value)} ${m.unit || ''}` : '—';
        const result = priv ? MASK : raw;
        const negative = !priv && /отриц|negativ|не обнаруж/i.test(String(last?.valueText || ''));
        return (
          <div
            key={m.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '12px 14px', borderRadius: 10, background: T.card, border: `1px solid ${T.border}`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ color: T.ink, fontFamily: T.fontMono, fontSize: 13 }}>{m.name_ru}</div>
              {last?.date && <div style={{ color: T.inkMuted, fontSize: 10, marginTop: 2 }}>{formatDate(last.date)}</div>}
            </div>
            <div
              style={{
                fontFamily: T.fontMono, fontSize: 13, fontWeight: 500, flexShrink: 0,
                color: negative ? STATUS_COLORS.ok.fg : T.inkSoft,
              }}
            >
              {result}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Таблица снимок × параметр (спермограммы, InBody-детали) ──
// rows = маркеры (строки), dates = снимок-даты по возрастанию (столбцы),
// ячейка = value_num или value_text; пусто, если параметра нет в эту дату.
// Числовые с отклонением подсвечиваются статусом (по direction/ref точки).
// Скроллится по горизонтали на узких экранах; первый столбец «прилипший».
function SnapshotTable({ dates, byDate, rows }) {
  const priv = usePrivacy();
  const thBase = {
    fontFamily: T.fontMono, fontSize: 10, fontWeight: 500, color: T.inkMuted,
    textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 12px',
    borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
  };
  const stickyBg = T.card;
  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${T.border}`, background: T.card }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: dates.length > 2 ? 460 : undefined }}>
        <thead>
          <tr>
            <th style={{ ...thBase, textAlign: 'left', position: 'sticky', left: 0, background: stickyBg, zIndex: 2 }}>
              показатель
            </th>
            {dates.map((d) => (
              <th key={d} style={{ ...thBase, textAlign: 'right', color: T.accent }}>{formatDate(d)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m, ri) => {
            const rowBg = ri % 2 ? 'rgba(255,255,255,0.015)' : 'transparent';
            return (
              <tr key={m.id}>
                <td
                  style={{
                    fontFamily: T.fontMono, fontSize: 12, color: T.inkSoft, padding: '9px 12px',
                    borderBottom: `1px solid ${T.borderSoft}`, position: 'sticky', left: 0,
                    background: ri % 2 ? '#131329' : stickyBg, zIndex: 1, whiteSpace: 'nowrap',
                  }}
                >
                  {m.name_ru}
                  {m.unit ? <span style={{ color: T.inkMuted, marginLeft: 5 }}>{m.unit}</span> : null}
                </td>
                {dates.map((d) => {
                  const cell = byDate[d] && byDate[d][m.id];
                  if (!cell) {
                    return (
                      <td key={d} style={{ padding: '9px 12px', textAlign: 'right', color: T.inkMuted, borderBottom: `1px solid ${T.borderSoft}`, background: rowBg, fontFamily: T.fontMono, fontSize: 12 }}>
                        —
                      </td>
                    );
                  }
                  const p = cell.point;
                  const num = p.value != null;
                  const st = num ? computeStatus(m.direction, p.value, m.refLow, m.refHigh) : 'none';
                  const s = pStatus(priv, st);
                  return (
                    <td
                      key={d}
                      style={{
                        padding: '9px 12px', textAlign: 'right', borderBottom: `1px solid ${T.borderSoft}`,
                        background: rowBg, fontFamily: T.fontMono, fontSize: 12, fontWeight: 500,
                        color: num ? s.fg : T.inkSoft, whiteSpace: 'nowrap',
                      }}
                    >
                      {num ? dispNum(priv, p.value) : dispText(priv, p.valueText)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Репродукция (задача №3) ──
// ПСА (онкомаркер) + TUNEL — отдельными тренд-карточками.
// Спермограммы (даты с >5 параметрами): тренд-карточки общих числовых показателей +
// таблица снимок×параметр (все показатели, включая качественные).
function isTunel(m) {
  return /tunel/i.test(m.id) || /tunel|фрагментац/i.test(m.name_ru);
}
function isPsa(m) {
  return /psa/i.test(m.id) || /пса|psa|простатспециф|простат-специф/i.test(m.name_ru);
}

function ReproductionView({ markers, onTap }) {
  const tunel = markers.filter(isTunel);
  const psa = markers.filter(isPsa);
  const spermMarkers = markers.filter((m) => !isTunel(m) && !isPsa(m));

  // Спермограммы = снимок-даты, где спермо-параметров >5 (одиночные «мусорные» даты отсеиваются).
  const { dates, byDate, common, rows } = snapshotMatrix(spermMarkers, 6);

  // Тренд-карточки — ТОЛЬКО общие ЧИСЛОВЫЕ показатели (числовые во ВСЕХ снимок-датах).
  const trendMarkers = [...common]
    .map((id) => spermMarkers.find((m) => m.id === id))
    .filter((m) => m && dates.every((d) => byDate[d][m.id] && byDate[d][m.id].point.value != null))
    .sort((a, b) => a.name_ru.localeCompare(b.name_ru, 'ru'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* ПСА — онкомаркер, отдельным блоком */}
      {psa.length > 0 && (
        <div>
          <SectionLabel>ПСА · онкомаркер простаты</SectionLabel>
          <div className="marker-grid">
            {psa.map((m) => <MarkerCard key={m.id} marker={m} onTap={onTap} />)}
          </div>
        </div>
      )}

      {/* TUNEL — фрагментация ДНК */}
      {tunel.length > 0 && (
        <div>
          <SectionLabel>TUNEL · фрагментация ДНК сперматозоидов</SectionLabel>
          <div className="marker-grid">
            {tunel.map((m) => <MarkerCard key={m.id} marker={m} onTap={onTap} />)}
          </div>
        </div>
      )}

      {/* Спермограммы — тренд-карточки общих числовых показателей */}
      {trendMarkers.length > 0 && (
        <div>
          <SectionLabel>Спермограмма · динамика общих показателей ({dates.length} снимка)</SectionLabel>
          <div className="marker-grid">
            {trendMarkers.map((m) => <MarkerCard key={m.id} marker={m} onTap={onTap} />)}
          </div>
        </div>
      )}

      {/* Таблица спермограмм — все показатели × даты */}
      {dates.length > 0 && (
        <div>
          <SectionLabel>Таблица спермограмм</SectionLabel>
          <SnapshotTable dates={dates} byDate={byDate} rows={rows} />
        </div>
      )}

      {dates.length === 0 && trendMarkers.length === 0 && psa.length === 0 && tunel.length === 0 && (
        <div style={{ color: T.inkMuted, fontSize: 13 }}>Нет данных по репродукции.</div>
      )}
    </div>
  );
}

// ── Состав тела (задача №5 + таблица снимков) ──
// Сверху — траектория ежедневного веса (/weight). Ниже — сводная таблица снимок×параметр
// (ВСЕ параметры всех замеров InBody, как в репродукции). Ниже — динамика ОБЩИХ параметров
// (пересечение по всем замерам) трендами. Аккордеоны-детали убраны: полная таблица делает
// их избыточными (те же значения по датам).
function BodyComposition({ markers, weight, onTap }) {
  const priv = usePrivacy();

  const weightPts = (weight || [])
    .map((w) => ({ ts: toNum(w.measure_date), weight: Number(w.weight_kg) }))
    .filter((w) => Number.isFinite(w.ts) && Number.isFinite(w.weight))
    .sort((a, b) => a.ts - b.ts);
  const cur = weightPts.length ? weightPts[weightPts.length - 1] : null;

  // Замеры InBody: снимок-матрица (любой замер = снимок, minParams=1).
  // rows — ВСЕ параметры, встречающиеся хотя бы в одном замере (для таблицы).
  const { dates, byDate, common, markerById, rows } = snapshotMatrix(markers, 1);

  // Общие параметры (пересечение analyte_id по всем замерам) — трендами.
  const commonMarkers = [...common]
    .map((id) => markerById[id])
    .filter(Boolean)
    .sort((a, b) => a.name_ru.localeCompare(b.name_ru, 'ru'));

  let wMin = Infinity;
  let wMax = -Infinity;
  for (const w of weightPts) {
    if (w.weight < wMin) wMin = w.weight;
    if (w.weight > wMax) wMax = w.weight;
  }
  const wDomain = weightPts.length
    ? [Math.floor((wMin - 2) / 10) * 10, Math.ceil((wMax + 2) / 10) * 10]
    : [90, 210];
  const xMin = weightPts.length ? weightPts[0].ts : toNum('2014-01-01');
  const xMax = weightPts.length ? weightPts[weightPts.length - 1].ts : toNum('2026-07-01');
  const yearTicks = [];
  {
    const y0 = new Date(xMin).getFullYear();
    const y1 = new Date(xMax).getFullYear();
    if (Number.isFinite(y0) && Number.isFinite(y1) && y1 >= y0 && y1 - y0 < 100) {
      for (let y = y0; y <= y1; y++) yearTicks.push(toNum(`${y}-01-01`));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Траектория ежедневного веса */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 500, color: T.ink, fontSize: 16, margin: 0 }}>Вес — ежедневная траектория</h3>
          <span style={{ color: T.inkMuted, fontFamily: T.fontMono, fontSize: 11 }}>{weightPts.length} точек</span>
        </div>
        {cur && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ color: T.amber, fontFamily: T.fontMono, fontSize: 30, fontWeight: 600 }}>{priv ? MASK : formatNum(cur.weight)}</span>
            <span style={{ color: T.inkMuted, fontSize: 12 }}>кг сейчас</span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={weightPts} margin={{ top: 6, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={T.borderSoft} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="ts" type="number" domain={[xMin, xMax]} ticks={yearTicks} tickFormatter={fmtYear}
              stroke={T.border} tick={{ fill: T.inkMuted, fontSize: 10, fontFamily: T.fontMono }}
            />
            <YAxis
              domain={wDomain} stroke={T.amber} width={38} tickFormatter={fmt2}
              tick={priv ? false : { fill: T.amber, fontSize: 10, fontFamily: T.fontMono }}
            />
            {!priv && (
              <Tooltip
                contentStyle={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: T.fontMono, fontSize: 11, color: T.ink }}
                labelFormatter={(ts) => fmtYear(ts)}
                formatter={(v) => [`${fmt2(v)} кг`, 'Вес']}
              />
            )}
            <Line type="monotone" dataKey="weight" stroke={T.amber} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Таблица всех замеров InBody — снимок×параметр (как в репродукции) */}
      <div>
        <SectionLabel>Все замеры InBody · таблица показателей ({dates.length} {dates.length === 1 ? 'замер' : 'замеров'})</SectionLabel>
        {dates.length === 0 ? (
          <div style={{ color: T.inkMuted, fontSize: 13 }}>Нет замеров InBody.</div>
        ) : (
          <SnapshotTable dates={dates} byDate={byDate} rows={rows} />
        )}
      </div>

      {/* Динамика общих параметров (пересечение по всем замерам) — трендами */}
      {commonMarkers.length > 0 && (
        <div>
          <SectionLabel>Общие параметры · динамика по {dates.length} замерам</SectionLabel>
          <div className="marker-grid">
            {commonMarkers.map((m) => <MarkerCard key={m.id} marker={m} onTap={onTap} />)}
          </div>
        </div>
      )}
    </div>
  );
}
