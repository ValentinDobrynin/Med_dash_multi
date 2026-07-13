// Адаптеры: сырые ответы API → структуры, которые ждут компоненты дэша.
// (ТЗ №3 §3.2 nearest-date join, §3.3 статус на лету.)

// «Граница» = в пределах BORDER_FRAC от ближайшего порога. Конфигурируемая константа.
export const BORDER_FRAC = 0.08;

// Порядок и русские имена панелей + тип отображения.
// kind: 'trend' (sparkline-грид + модалка) | 'serology' (список) |
//       'reproduction' (полный снимок + свёрнутые даты) | 'body' (траектория веса + InBody-снимки)
export const PANEL_META = {
  lipids_cardio: { name_ru: 'Липиды и кардио', kind: 'trend' },
  thyroid: { name_ru: 'Щитовидка', kind: 'trend' },
  glucose_metabolism: { name_ru: 'Сахар / метаболизм', kind: 'trend' },
  iron_electrolytes: { name_ru: 'Железо и электролиты', kind: 'trend' },
  blood_count: { name_ru: 'ОАК', kind: 'trend' },
  biochem: { name_ru: 'Биохимия', kind: 'trend' },
  inflammation_hemostasis: { name_ru: 'Воспаление и гемостаз', kind: 'trend' },
  sex_steroids: { name_ru: 'Половые стероиды', kind: 'trend' },
  vitamins_antioxidants: { name_ru: 'Витамины и антиоксиданты', kind: 'trend' },
  body_composition: { name_ru: 'Состав тела', kind: 'body' },
  other_markers: { name_ru: 'Прочие маркеры', kind: 'trend' },
  immune_infections: { name_ru: 'Иммунитет и инфекции', kind: 'serology' },
  reproduction: { name_ru: 'Репродукция', kind: 'reproduction' },
};

const PANEL_ORDER = Object.keys(PANEL_META);

// ── Статус на лету (ТЗ §3.3) ──
export function computeStatus(direction, value, refLow, refHigh, borderFrac = BORDER_FRAC) {
  if (value == null || direction === 'informational') return 'none';

  if (direction === 'higher_worse') {
    if (refHigh == null) return 'none';
    if (value > refHigh) return 'alert';
    if (value >= refHigh * (1 - borderFrac)) return 'warn';
    return 'ok';
  }
  if (direction === 'lower_worse') {
    if (refLow == null) return 'none';
    if (value < refLow) return 'alert';
    if (value <= refLow * (1 + borderFrac)) return 'warn';
    return 'ok';
  }
  if (direction === 'window') {
    if (refLow != null && value < refLow) return 'alert';
    if (refHigh != null && value > refHigh) return 'alert';
    if (refLow != null && refHigh != null) {
      const span = refHigh - refLow;
      const margin = span * borderFrac;
      if (value < refLow + margin || value > refHigh - margin) return 'warn';
    } else if (refHigh != null && value >= refHigh * (1 - borderFrac)) {
      return 'warn';
    } else if (refLow != null && value <= refLow * (1 + borderFrac)) {
      return 'warn';
    }
    return 'ok';
  }
  return 'none';
}

// ── Индекс словаря ──
function indexDictionary(dictionary) {
  const map = {};
  (dictionary || []).forEach((d) => {
    map[d.analyte_id] = d;
  });
  return map;
}

// ── Построение маркеров из /labs ──
// Возвращает map analyte_id → marker с series точек {date, ts, value, seq, valueText}.
export function buildMarkers(labs, dictionary) {
  const dict = indexDictionary(dictionary);
  const byId = {};

  (labs || []).forEach((r) => {
    const id = r.analyte_id;
    if (!byId[id]) {
      const meta = dict[id] || {};
      byId[id] = {
        id,
        name_ru: r.name_ru || meta.name_ru || id,
        panel: r.panel || meta.panel || 'other_markers',
        unit: r.unit || meta.unit_canonical || '',
        direction: r.direction || meta.direction || 'informational',
        value_type: r.value_type || meta.value_type || 'quantitative',
        refLow: r.ref_low ?? null,
        refHigh: r.ref_high ?? null,
        refRaw: r.ref_raw ?? null,
        points: [],
      };
    }
    const m = byId[id];
    // референс берём из самой свежей строки, у которой он задан
    if (r.ref_low != null || r.ref_high != null) {
      m.refLow = r.ref_low ?? m.refLow;
      m.refHigh = r.ref_high ?? m.refHigh;
      m.refRaw = r.ref_raw ?? m.refRaw;
    }
    m.points.push({
      date: r.sample_date,
      ts: new Date(r.sample_date).getTime(),
      value: r.value_num ?? null,
      valueText: r.value_text ?? null,
      seq: r.seq ?? 0,
    });
  });

  Object.values(byId).forEach((m) => {
    // сортируем по дате, затем по seq (обе точки двойного значения остаются)
    m.points.sort((a, b) => (a.ts - b.ts) || (a.seq - b.seq));

    // последняя дата
    const lastDate = m.points.length ? m.points[m.points.length - 1].date : null;
    const atLast = m.points.filter((p) => p.date === lastDate);
    // для статуса берём seq=0 (иначе минимальный seq)
    const primary = atLast.find((p) => p.seq === 0) || atLast[0] || null;
    m.last = primary
      ? { date: primary.date, value: primary.value, valueText: primary.valueText, seq: primary.seq }
      : null;
    m.status = primary
      ? computeStatus(m.direction, primary.value, m.refLow, m.refHigh)
      : 'none';
    // предыдущее значение (последняя точка предыдущей даты, seq=0)
    const prevDates = [...new Set(m.points.map((p) => p.date))];
    const prevDate = prevDates.length >= 2 ? prevDates[prevDates.length - 2] : null;
    if (prevDate) {
      const prevAt = m.points.filter((p) => p.date === prevDate);
      const pv = prevAt.find((p) => p.seq === 0) || prevAt[0];
      m.prev = pv ? { date: pv.date, value: pv.value } : null;
    } else {
      m.prev = null;
    }
  });

  return byId;
}

// ── Группировка маркеров по панелям (Screen A) ──
export function buildPanels(markersMap) {
  const groups = {};
  Object.values(markersMap).forEach((m) => {
    const pid = PANEL_META[m.panel] ? m.panel : 'other_markers';
    if (!groups[pid]) groups[pid] = [];
    groups[pid].push(m);
  });

  const panels = PANEL_ORDER.filter((pid) => groups[pid] && groups[pid].length).map((pid) => {
    const markers = groups[pid].sort((a, b) => a.name_ru.localeCompare(b.name_ru, 'ru'));
    const counts = { alert: 0, warn: 0, ok: 0, none: 0 };
    markers.forEach((m) => {
      counts[m.status] = (counts[m.status] || 0) + 1;
    });
    // «горячие» отклонения (1–3) для карточки группы
    const hot = markers
      .filter((m) => m.status === 'alert' || m.status === 'warn')
      .sort((a, b) => (a.status === 'alert' ? -1 : 1) - (b.status === 'alert' ? -1 : 1))
      .slice(0, 3)
      .map((m) => ({ name: m.name_ru, status: m.status, value: m.last?.value }));
    return { id: pid, ...PANEL_META[pid], markers, counts, hot };
  });

  return panels;
}

// ── Глобальные счётчики статусов (для пилюль Screen A) ──
export function statusTotals(markersMap) {
  const t = { alert: 0, warn: 0, ok: 0, none: 0 };
  Object.values(markersMap).forEach((m) => {
    t[m.status] = (t[m.status] || 0) + 1;
  });
  return t;
}

// ── Nearest-date join лаба ↔ вес (ТЗ §3.2) ──
// Возвращает {weight, deltaDays, quality} | null. quality: exact ±3, close ±30, coarse >30.
export function nearestWeight(dateStr, weightSorted) {
  if (!weightSorted || !weightSorted.length) return null;
  const t = new Date(dateStr).getTime();
  let best = null;
  let bestDelta = Infinity;
  for (const w of weightSorted) {
    const d = Math.abs(new Date(w.measure_date).getTime() - t) / 86400000;
    if (d < bestDelta) {
      bestDelta = d;
      best = w;
    }
  }
  if (!best) return null;
  const quality = bestDelta <= 3 ? 'exact' : bestDelta <= 30 ? 'close' : 'coarse';
  return { weight: best.weight_kg, deltaDays: Math.round(bestDelta), quality };
}

// ── Обобщённый nearest-date join двух произвольных рядов (Screen C, A↔B) ──
// point = {ts, date, value}. Возвращает ближайшую точку ряда и дельту в днях.
export function nearestPoint(ts, sortedPoints) {
  if (!sortedPoints || !sortedPoints.length) return null;
  let best = null;
  let bestDelta = Infinity;
  for (const p of sortedPoints) {
    const d = Math.abs(p.ts - ts) / 86400000;
    if (d < bestDelta) {
      bestDelta = d;
      best = p;
    }
  }
  if (!best) return null;
  return { point: best, deltaDays: bestDelta };
}

// joinSeries: пары {a, b, quality, date, delta} по nearest-date join.
// Идём по более РАЗРЕЖЕННОМУ ряду (меньше точек) и ищем ближайшую точку второго
// в окне maxDays. quality: exact ±3, close ±30, coarse >30. a — значение sA, b — sB.
export function joinSeries(sA, sB, maxDays) {
  const a = (sA && sA.points) || [];
  const b = (sB && sB.points) || [];
  if (!a.length || !b.length) return [];
  const aIsSparse = a.length <= b.length; // при равенстве идём по A
  const sparse = aIsSparse ? a : b;
  const dense = aIsSparse ? b : a;
  const pairs = [];
  for (const sp of sparse) {
    const np = nearestPoint(sp.ts, dense);
    if (!np || np.deltaDays > maxDays) continue;
    const delta = np.deltaDays;
    const quality = delta <= 3 ? 'exact' : delta <= 30 ? 'close' : 'coarse';
    const aVal = aIsSparse ? sp.value : np.point.value;
    const bVal = aIsSparse ? np.point.value : sp.value;
    pairs.push({ a: aVal, b: bVal, quality, date: sp.date, delta: Math.round(delta) });
  }
  return pairs;
}

// Пирсоновская корреляция двух рядов
export function pearson(pairs) {
  const n = pairs.length;
  if (n < 2) return NaN;
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return NaN;
  return num / Math.sqrt(dx * dy);
}

// ── Снимки: даты-снимки, общие vs частичные параметры (репродукция + биоимпеданс) ──
// Одна и та же логика для спермограмм и InBody: набор маркеров, у каждого свои points
// по датам. Дата считается «снимком», если на ней ≥ minParams параметров (репродукция:
// >5 спермо-показателей → minParams=6; тело: любой замер → minParams=1). Логика по датам,
// без хардкода: если добавится новая дата-снимок — пересчитывается автоматически.
//
// Возвращает:
//   dates      — снимок-даты по возрастанию (YYYY-MM-DD)
//   byDate     — { [date]: { [analyte_id]: { marker, point } } }
//   common     — Set(analyte_id), присутствующих во ВСЕХ снимок-датах (пересечение)
//   rows       — маркеры, встречающиеся хотя бы в одной снимок-дате, сорт. по name_ru
//   markerById — { [analyte_id]: marker }
export function snapshotMatrix(markers, minParams = 1) {
  const byDate = {};
  const idSetByDate = {};
  const markerById = {};
  (markers || []).forEach((m) => {
    markerById[m.id] = m;
    (m.points || []).forEach((p) => {
      if (p.value == null && p.valueText == null) return;
      byDate[p.date] = byDate[p.date] || {};
      const cur = byDate[p.date][m.id];
      // при дублях (seq>0) оставляем минимальный seq (основное значение)
      if (!cur || (p.seq ?? 0) < (cur.point.seq ?? 0)) byDate[p.date][m.id] = { marker: m, point: p };
      (idSetByDate[p.date] = idSetByDate[p.date] || new Set()).add(m.id);
    });
  });

  const dates = Object.keys(byDate)
    .filter((d) => idSetByDate[d].size >= minParams)
    .sort();

  let common = null;
  dates.forEach((d) => {
    const ids = idSetByDate[d];
    common = common == null ? new Set(ids) : new Set([...common].filter((id) => ids.has(id)));
  });
  common = common || new Set();

  const rowIds = new Set();
  dates.forEach((d) => idSetByDate[d].forEach((id) => rowIds.add(id)));
  const rows = [...rowIds]
    .map((id) => markerById[id])
    .sort((a, b) => a.name_ru.localeCompare(b.name_ru, 'ru'));

  return { dates, byDate, common, rows, markerById };
}

// Список quantitative-маркеров для дропдауна Screen C
export function quantitativeMarkers(markersMap) {
  return Object.values(markersMap)
    .filter((m) => m.value_type === 'quantitative' && m.points.some((p) => p.value != null))
    .sort((a, b) => a.name_ru.localeCompare(b.name_ru, 'ru'));
}
