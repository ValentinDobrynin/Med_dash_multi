import { useMemo, useState } from 'react';
import { STATUS_COLORS, T } from '../theme.js';
import { formatDate } from '../utils.js';
import { usePrivacy, MASK } from '../privacy.jsx';

// Раздел «Медкарта» — не-лабораторные события (GET /events).
// Подвальный блок экрана «Анализы», под сеткой групп. 4 подгруппы, карточки-аккордеоны.

// Порядок и русские заголовки подгрупп. Список специальностей пред-заполнен: новые
// домены (напр. андрология) появляются на дэше сами, с корректным русским заголовком,
// без правки кода. Группа не из этого списка тоже покажется — в конце, с заголовком-
// фолбэком (капитализация слага). Пустые группы (без событий) не рендерятся.
const GROUP_ORDER = [
  'diagnoses',       // всегда первым — проблем-лист
  'cardiology',
  'gastro',
  'andrology',
  'urology',
  'nephrology',
  'endocrinology',
  'neurology',
  'pulmonology',
  'dermatology',
  'ophthalmology',
  'ent',             // ЛОР
  'dentistry',
  'orthopedics',
  'oncology',
  'imaging',         // кросс-доменные — ближе к концу
  'surgeries',
];
const GROUP_TITLES = {
  diagnoses: 'Активные диагнозы',
  cardiology: 'Кардиология',
  gastro: 'Гастроэнтерология',
  andrology: 'Андрология',
  urology: 'Урология',
  nephrology: 'Нефрология',
  endocrinology: 'Эндокринология',
  neurology: 'Неврология',
  pulmonology: 'Пульмонология',
  dermatology: 'Дерматология',
  ophthalmology: 'Офтальмология',
  ent: 'ЛОР',
  dentistry: 'Стоматология',
  orthopedics: 'Ортопедия и травматология',
  oncology: 'Онкология',
  imaging: 'Визуализация и осмотры',
  surgeries: 'Операции',
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Статус-тег: цвет + подпись. null → тег не показываем.
const STATUS_TAG = {
  active: { label: 'активно', fg: T.accent, bg: 'rgba(129,140,248,0.16)', border: T.accent },
  history: { label: 'в анамнезе', fg: STATUS_COLORS.none.fg, bg: STATUS_COLORS.none.bg, border: STATUS_COLORS.none.border },
  resolved: { label: 'разрешено', fg: STATUS_COLORS.ok.fg, bg: STATUS_COLORS.ok.bg, border: STATUS_COLORS.ok.border },
};

// Дата: ISO YYYY-MM-DD → «22 мар 2026»; год «2014» / «2023-11» → как есть.
function displayDate(d) {
  if (!d) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? formatDate(d) : d;
}

function StatusTag({ status }) {
  const t = STATUS_TAG[status];
  if (!t) return null; // status === null → без тега
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999,
        fontSize: 10, fontFamily: T.fontMono, letterSpacing: '0.02em',
        color: t.fg, background: t.bg, border: `1px solid ${t.border}`, flexShrink: 0,
      }}
    >
      {t.label}
    </span>
  );
}

// Компактная таблица метрик «k | v». Значения — моно-шрифт, маскируются в приватном режиме.
function MetricsTable({ metrics, priv }) {
  if (!metrics || metrics.length === 0) return null;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
      <tbody>
        {metrics.map((m, i) => (
          <tr key={i} style={{ borderTop: i === 0 ? 'none' : `1px solid ${T.borderSoft}` }}>
            <td style={{ padding: '5px 10px 5px 0', color: T.inkSoft, fontSize: 12, verticalAlign: 'top', width: '46%' }}>
              {m.k}
            </td>
            <td style={{ padding: '5px 0', color: T.ink, fontFamily: T.fontMono, fontSize: 12, verticalAlign: 'top' }}>
              {priv ? MASK : m.v}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EventCard({ ev }) {
  const priv = usePrivacy();
  const [open, setOpen] = useState(false);
  const hasDetail = Array.isArray(ev.detail) && ev.detail.length > 0;

  return (
    <div
      style={{
        borderRadius: 14, background: T.card, border: `1px solid ${T.border}`,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Свёрнутая шапка — вся кликабельна */}
      <button
        onClick={() => hasDetail && setOpen((v) => !v)}
        className="tap"
        style={{
          width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
          padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 8,
          cursor: hasDetail ? 'pointer' : 'default',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = T.cardHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: T.ink, fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 500, lineHeight: 1.2, minWidth: 0 }}>
            {ev.title}
          </span>
          {hasDetail && (
            <span style={{ color: T.inkMuted, fontSize: 16, flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
              ›
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ color: T.inkMuted, fontFamily: T.fontMono, fontSize: 11 }}>{displayDate(ev.date)}</span>
          <StatusTag status={ev.status} />
        </div>

        {ev.summary && (
          <p style={{ margin: 0, color: T.inkSoft, fontSize: 13, lineHeight: 1.45 }}>
            {priv ? MASK : ev.summary}
          </p>
        )}
      </button>

      {/* Разворот-аккордеон: блоки detail */}
      {open && hasDetail && (
        <div className="animate-fadeIn" style={{ padding: '0 15px 15px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ev.detail.map((block, bi) => (
            <div key={bi} style={{ borderTop: `1px solid ${T.borderSoft}`, paddingTop: 12 }}>
              {block.heading && (
                <div style={{ color: T.inkMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                  {block.heading}
                </div>
              )}
              <MetricsTable metrics={block.metrics} priv={priv} />
              {block.note && (
                <p style={{ margin: '10px 0 0', color: T.inkSoft, fontSize: 12.5, lineHeight: 1.5 }}>
                  {priv ? MASK : block.note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// standalone=true — компонент рендерится как самостоятельный экран (таб «Медкарта»):
//   без подвального top-border/отступа и с мягким плейсхолдером при пустых данных.
// standalone=false (по умолчанию) — прежнее поведение подвала: пусто → null.
export default function MedRecordSection({ events, standalone = false }) {
  // Группировка по group с сохранением исходного порядка внутри группы.
  const byGroup = useMemo(() => {
    const g = {};
    (events || []).forEach((e) => {
      if (!e || !e.group) return;
      (g[e.group] = g[e.group] || []).push(e);
    });
    return g;
  }, [events]);

  // Известные группы в заданном порядке + любые новые (не из списка) — в конце.
  const visibleGroups = useMemo(() => {
    const present = Object.keys(byGroup).filter((id) => byGroup[id].length > 0);
    const known = GROUP_ORDER.filter((id) => present.includes(id));
    const unknown = present.filter((id) => !GROUP_ORDER.includes(id)).sort();
    return [...known, ...unknown].map((id) => ({ id, title: GROUP_TITLES[id] || cap(id) }));
  }, [byGroup]);

  if (visibleGroups.length === 0) {
    if (!standalone) return null; // подвал: события опциональны — нет данных, нет раздела
    // отдельный таб: мягкий плейсхолдер вместо пустоты
    return (
      <div
        style={{
          padding: '40px 24px', textAlign: 'center', borderRadius: 14,
          background: T.card, border: `1px dashed ${T.border}`, color: T.inkMuted, fontSize: 14,
        }}
      >
        Нет данных медкарты
      </div>
    );
  }

  const sectionStyle = standalone
    ? { marginTop: 0 }
    : { marginTop: 40, paddingTop: 28, borderTop: `1px solid ${T.border}` };

  return (
    <section style={sectionStyle}>
      <h2 style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontStyle: 'italic', color: T.ink, fontSize: 26, margin: '0 0 4px' }}>
        Медкарта
      </h2>
      <div style={{ color: T.inkMuted, fontSize: 12, marginBottom: 22 }}>
        Не-лабораторные данные: диагнозы, кардиология, гастро, визуализация, операции
      </div>

      {visibleGroups.map((g) => (
        <div key={g.id} style={{ marginBottom: 28 }}>
          <h3 style={{ fontFamily: T.fontDisplay, fontWeight: 500, color: T.ink, fontSize: 18, margin: '0 0 12px' }}>
            {g.title}
          </h3>
          <div className="group-grid">
            {byGroup[g.id].map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
