// Мок-режим (dev-инструмент, VITE_USE_MOCK=1). Отдаёт РЕАЛИСТИЧНЫЙ большой набор в
// том же формате, что и реальный API (ТЗ №2 §2.4–2.6 + /health), чтобы дэш можно было
// смотреть и стресс-тестировать без бэкенда.
//
// Реализм (для воспроизведения прод-кейсов, правка №4б):
//   • вес — ~480 ежедневных точек 2014→2026, значения 100–206 кг;
//   • 30+ маркеров с реальными паттернами (тренды, шум, разные направления);
//   • маркеры с ОДНОЙ точкой (lp_a, homa_ir, testosterone_free);
//   • маркеры с value_num=null (качественные серология/агглютинация + один «<0.5» текст);
//   • все даты в формате YYYY-MM-DD;
//   • InBody — 3 замера, 12 общих параметров во всех + частичные (вода/сегменты/ИТБ/ИОО);
//   • репродукция — 3 спермограммы (2017/2019/2025, 12 общих числ. + 2 качеств. + 1 частичный),
//     TUNEL на 2 датах, ПСА на отдельной дате.

// ── Словарь маркеров ──
// Поля low/high/raw используются только для генерации мок-строк (в реальном API
// референсы приходят в самих строках /labs). value_type: quantitative|qualitative|titer.
const DICT = [
  // lipids_cardio ------------------------------------------------------------
  { analyte_id: 'ldl_c', name_ru: 'Холестерин ЛПНП', panel: 'lipids_cardio', unit_canonical: 'ммоль/л', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 3.0, base: 5.1, jitter: 0.5, dp: 2 },
  { analyte_id: 'hdl_c', name_ru: 'Холестерин ЛПВП', panel: 'lipids_cardio', unit_canonical: 'ммоль/л', value_type: 'quantitative', direction: 'lower_worse', low: 1.0, high: null, base: 1.15, jitter: 0.2, dp: 2 },
  { analyte_id: 'total_chol', name_ru: 'Холестерин общий', panel: 'lipids_cardio', unit_canonical: 'ммоль/л', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 5.2, base: 6.6, jitter: 0.6, dp: 2 },
  { analyte_id: 'triglycerides', name_ru: 'Триглицериды', panel: 'lipids_cardio', unit_canonical: 'ммоль/л', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 1.7, base: 1.35, jitter: 0.4, dp: 2 },
  { analyte_id: 'apo_b', name_ru: 'Аполипопротеин B', panel: 'lipids_cardio', unit_canonical: 'г/л', value_type: 'quantitative', direction: 'higher_worse', low: 0.6, high: 1.33, base: 1.28, jitter: 0.18, dp: 2 },
  { analyte_id: 'lp_a', name_ru: 'Липопротеин (a)', panel: 'lipids_cardio', unit_canonical: 'нмоль/л', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 75, base: 42, jitter: 0, dp: 0, single: true },
  // thyroid ------------------------------------------------------------------
  { analyte_id: 'tsh', name_ru: 'Тиреотропный гормон', panel: 'thyroid', unit_canonical: 'мкМЕ/мл', value_type: 'quantitative', direction: 'window', low: 0.4, high: 4.0, base: 1.4, jitter: 0.5, dp: 2 },
  { analyte_id: 'ft4', name_ru: 'Тироксин свободный', panel: 'thyroid', unit_canonical: 'пмоль/л', value_type: 'quantitative', direction: 'window', low: 9.0, high: 19.04, base: 17.6, jitter: 2.2, dp: 1 },
  { analyte_id: 'ft3', name_ru: 'Трийодтиронин свободный', panel: 'thyroid', unit_canonical: 'пмоль/л', value_type: 'quantitative', direction: 'window', low: 2.6, high: 5.7, base: 4.4, jitter: 0.6, dp: 2 },
  { analyte_id: 'calcitonin', name_ru: 'Кальцитонин', panel: 'thyroid', unit_canonical: 'пг/мл', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 9.52, base: 11.5, jitter: 2.8, dp: 2 },
  { analyte_id: 'anti_tpo', name_ru: 'Антитела к ТПО', panel: 'thyroid', unit_canonical: 'МЕ/мл', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 34, base: 6, jitter: 12, dp: 1 },
  // glucose_metabolism -------------------------------------------------------
  { analyte_id: 'glucose', name_ru: 'Глюкоза натощак', panel: 'glucose_metabolism', unit_canonical: 'ммоль/л', value_type: 'quantitative', direction: 'window', low: 4.1, high: 5.9, base: 5.0, jitter: 0.5, dp: 2 },
  { analyte_id: 'hba1c', name_ru: 'Гликированный гемоглобин', panel: 'glucose_metabolism', unit_canonical: '%', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 6.0, base: 5.5, jitter: 0.3, dp: 1 },
  { analyte_id: 'insulin', name_ru: 'Инсулин', panel: 'glucose_metabolism', unit_canonical: 'мкМЕ/мл', value_type: 'quantitative', direction: 'window', low: 2.7, high: 24.8, base: 9.0, jitter: 4.0, dp: 1 },
  { analyte_id: 'homa_ir', name_ru: 'Индекс HOMA-IR', panel: 'glucose_metabolism', unit_canonical: '', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 2.7, base: 2.0, jitter: 0, dp: 2, single: true },
  // iron_electrolytes --------------------------------------------------------
  { analyte_id: 'ferritin', name_ru: 'Ферритин', panel: 'iron_electrolytes', unit_canonical: 'нг/мл', value_type: 'quantitative', direction: 'window', low: 23.9, high: 336.2, base: 42, jitter: 16, dp: 1 },
  { analyte_id: 'iron_serum', name_ru: 'Железо сыворотки', panel: 'iron_electrolytes', unit_canonical: 'мкмоль/л', value_type: 'quantitative', direction: 'window', low: 10.7, high: 32.2, base: 17, jitter: 5, dp: 1 },
  { analyte_id: 'hemoglobin', name_ru: 'Гемоглобин', panel: 'iron_electrolytes', unit_canonical: 'г/л', value_type: 'quantitative', direction: 'window', low: 130, high: 170, base: 150, jitter: 8, dp: 0 },
  { analyte_id: 'potassium', name_ru: 'Калий сыворотки', panel: 'iron_electrolytes', unit_canonical: 'ммоль/л', value_type: 'quantitative', direction: 'window', low: 3.5, high: 5.1, base: 4.5, jitter: 0.35, dp: 2 },
  { analyte_id: 'sodium', name_ru: 'Натрий сыворотки', panel: 'iron_electrolytes', unit_canonical: 'ммоль/л', value_type: 'quantitative', direction: 'window', low: 136, high: 145, base: 140, jitter: 2, dp: 0 },
  { analyte_id: 'magnesium', name_ru: 'Магний', panel: 'iron_electrolytes', unit_canonical: 'ммоль/л', value_type: 'quantitative', direction: 'window', low: 0.66, high: 1.07, base: 0.82, jitter: 0.08, dp: 2 },
  // blood_count --------------------------------------------------------------
  { analyte_id: 'erythrocytes', name_ru: 'Эритроциты', panel: 'blood_count', unit_canonical: '10¹²/л', value_type: 'quantitative', direction: 'window', low: 4.3, high: 5.7, base: 5.0, jitter: 0.3, dp: 2 },
  { analyte_id: 'leukocytes', name_ru: 'Лейкоциты', panel: 'blood_count', unit_canonical: '10⁹/л', value_type: 'quantitative', direction: 'window', low: 4.0, high: 9.0, base: 6.2, jitter: 1.4, dp: 1 },
  { analyte_id: 'platelets', name_ru: 'Тромбоциты', panel: 'blood_count', unit_canonical: '10⁹/л', value_type: 'quantitative', direction: 'window', low: 150, high: 400, base: 250, jitter: 40, dp: 0 },
  { analyte_id: 'esr', name_ru: 'СОЭ', panel: 'blood_count', unit_canonical: 'мм/ч', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 15, base: 8, jitter: 4, dp: 0 },
  // biochem ------------------------------------------------------------------
  { analyte_id: 'alt', name_ru: 'АЛТ', panel: 'biochem', unit_canonical: 'Ед/л', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 41, base: 33, jitter: 12, dp: 0 },
  { analyte_id: 'ast', name_ru: 'АСТ', panel: 'biochem', unit_canonical: 'Ед/л', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 40, base: 28, jitter: 8, dp: 0 },
  { analyte_id: 'creatinine', name_ru: 'Креатинин', panel: 'biochem', unit_canonical: 'мкмоль/л', value_type: 'quantitative', direction: 'window', low: 62, high: 106, base: 88, jitter: 8, dp: 0 },
  { analyte_id: 'uric_acid', name_ru: 'Мочевая кислота', panel: 'biochem', unit_canonical: 'мкмоль/л', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 420, base: 400, jitter: 45, dp: 0 },
  { analyte_id: 'bilirubin_total', name_ru: 'Билирубин общий', panel: 'biochem', unit_canonical: 'мкмоль/л', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 20.5, base: 14, jitter: 5, dp: 1 },
  // inflammation_hemostasis --------------------------------------------------
  { analyte_id: 'crp', name_ru: 'C-реактивный белок', panel: 'inflammation_hemostasis', unit_canonical: 'мг/л', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 5.0, base: 2.2, jitter: 1.6, dp: 2 },
  { analyte_id: 'homocysteine', name_ru: 'Гомоцистеин', panel: 'inflammation_hemostasis', unit_canonical: 'мкмоль/л', value_type: 'quantitative', direction: 'higher_worse', low: null, high: 15, base: 12, jitter: 3, dp: 1 },
  // vitamins_antioxidants ----------------------------------------------------
  { analyte_id: 'vitamin_d', name_ru: 'Витамин D (25-OH)', panel: 'vitamins_antioxidants', unit_canonical: 'нг/мл', value_type: 'quantitative', direction: 'lower_worse', low: 30, high: null, base: 28, jitter: 8, dp: 1 },
  { analyte_id: 'vitamin_b12', name_ru: 'Витамин B12', panel: 'vitamins_antioxidants', unit_canonical: 'пг/мл', value_type: 'quantitative', direction: 'window', low: 187, high: 883, base: 420, jitter: 90, dp: 0 },
  // sex_steroids -------------------------------------------------------------
  { analyte_id: 'testosterone_total', name_ru: 'Тестостерон общий', panel: 'sex_steroids', unit_canonical: 'нмоль/л', value_type: 'quantitative', direction: 'window', low: 8.6, high: 29, base: 14, jitter: 3.5, dp: 2 },
  { analyte_id: 'testosterone_free', name_ru: 'Тестостерон свободный', panel: 'sex_steroids', unit_canonical: 'пг/мл', value_type: 'quantitative', direction: 'window', low: 8.8, high: 27, base: 9.5, jitter: 0, dp: 2, single: true },
  // other_markers ------------------------------------------------------------
  { analyte_id: 'omega3_index', name_ru: 'Индекс Омега-3', panel: 'other_markers', unit_canonical: '%', value_type: 'quantitative', direction: 'lower_worse', low: 8, high: null, base: 5.0, jitter: 1.0, dp: 1 },

  // immune_infections (серология — value_num=null) ---------------------------
  { analyte_id: 'hbsag', name_ru: 'HBsAg', panel: 'immune_infections', unit_canonical: null, value_type: 'qualitative', direction: 'informational' },
  { analyte_id: 'anti_hcv', name_ru: 'Anti-HCV суммарные', panel: 'immune_infections', unit_canonical: null, value_type: 'qualitative', direction: 'informational' },
  { analyte_id: 'anti_hiv', name_ru: 'Anti-HIV 1/2', panel: 'immune_infections', unit_canonical: null, value_type: 'qualitative', direction: 'informational' },
  { analyte_id: 'rpr_syphilis', name_ru: 'RPR (сифилис)', panel: 'immune_infections', unit_canonical: null, value_type: 'qualitative', direction: 'informational' },
  { analyte_id: 'anti_tetanus_igg', name_ru: 'Anti-Tetanus IgG', panel: 'immune_infections', unit_canonical: 'МЕ/мл', value_type: 'titer', direction: 'informational' },

  // body_composition (InBody — снимки по датам: 12 общих + частичные) --------
  // Общие 12 (во всех замерах) — трендятся; частичные (вода/сегменты/ИТБ/ИОО) — по датам.
  { analyte_id: 'bia_weight', name_ru: 'Вес (InBody)', panel: 'body_composition', unit_canonical: 'кг', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_muscle', name_ru: 'Мышечная масса (СММ)', panel: 'body_composition', unit_canonical: 'кг', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_fat_mass', name_ru: 'Жировая масса', panel: 'body_composition', unit_canonical: 'кг', value_type: 'quantitative', direction: 'higher_worse' },
  { analyte_id: 'bia_fat_pct', name_ru: 'Процент жира (ПЖТ)', panel: 'body_composition', unit_canonical: '%', value_type: 'quantitative', direction: 'higher_worse' },
  { analyte_id: 'bia_protein', name_ru: 'Протеины', panel: 'body_composition', unit_canonical: 'кг', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_mineral', name_ru: 'Минеральные вещества', panel: 'body_composition', unit_canonical: 'кг', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_bmi', name_ru: 'ИМТ', panel: 'body_composition', unit_canonical: 'кг/м²', value_type: 'quantitative', direction: 'higher_worse' },
  { analyte_id: 'bia_ideal_weight', name_ru: 'Идеальный вес', panel: 'body_composition', unit_canonical: 'кг', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_weight_control', name_ru: 'Контроль веса', panel: 'body_composition', unit_canonical: 'кг', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_fat_control', name_ru: 'Контроль жира', panel: 'body_composition', unit_canonical: 'кг', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_muscle_control', name_ru: 'Контроль мускулатуры', panel: 'body_composition', unit_canonical: 'кг', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_fitness_score', name_ru: 'Фитнес-очки', panel: 'body_composition', unit_canonical: '', value_type: 'quantitative', direction: 'informational' },
  // частичные (не во всех замерах)
  { analyte_id: 'bia_water_tbw', name_ru: 'Общая вода тела (TBW)', panel: 'body_composition', unit_canonical: 'л', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_water_icw', name_ru: 'Внутриклеточная вода (ICW)', panel: 'body_composition', unit_canonical: 'л', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_water_ecw', name_ru: 'Внеклеточная вода (ECW)', panel: 'body_composition', unit_canonical: 'л', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_muscle_ra', name_ru: 'Мышцы: правая рука', panel: 'body_composition', unit_canonical: 'кг', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_muscle_la', name_ru: 'Мышцы: левая рука', panel: 'body_composition', unit_canonical: 'кг', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_whr', name_ru: 'ИТБ (талия/бёдра)', panel: 'body_composition', unit_canonical: '', value_type: 'quantitative', direction: 'higher_worse' },
  { analyte_id: 'bia_bmr', name_ru: 'Основной обмен (ИОО)', panel: 'body_composition', unit_canonical: 'ккал', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'bia_visceral', name_ru: 'Висцеральный жир', panel: 'body_composition', unit_canonical: 'см²', value_type: 'quantitative', direction: 'higher_worse' },

  // reproduction -------------------------------------------------------------
  // низ/верх реф-интервалов заданы прямо здесь → pushRow подхватит для статуса.
  { analyte_id: 'sperm_volume', name_ru: 'Объём эякулята', panel: 'reproduction', unit_canonical: 'мл', value_type: 'quantitative', direction: 'lower_worse', low: 1.5 },
  { analyte_id: 'sperm_concentration', name_ru: 'Концентрация сперматозоидов', panel: 'reproduction', unit_canonical: 'млн/мл', value_type: 'quantitative', direction: 'lower_worse', low: 16 },
  { analyte_id: 'sperm_count_total', name_ru: 'Общее количество', panel: 'reproduction', unit_canonical: 'млн', value_type: 'quantitative', direction: 'lower_worse', low: 39 },
  { analyte_id: 'sperm_motility_pr', name_ru: 'Прогрессивная подвижность', panel: 'reproduction', unit_canonical: '%', value_type: 'quantitative', direction: 'lower_worse', low: 30 },
  { analyte_id: 'sperm_motility_total', name_ru: 'Общая подвижность', panel: 'reproduction', unit_canonical: '%', value_type: 'quantitative', direction: 'lower_worse', low: 40 },
  { analyte_id: 'sperm_motility_np', name_ru: 'Непрогрессивная подвижность', panel: 'reproduction', unit_canonical: '%', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'sperm_morphology', name_ru: 'Нормальные формы', panel: 'reproduction', unit_canonical: '%', value_type: 'quantitative', direction: 'lower_worse', low: 4 },
  { analyte_id: 'sperm_vitality', name_ru: 'Жизнеспособность', panel: 'reproduction', unit_canonical: '%', value_type: 'quantitative', direction: 'lower_worse', low: 54 },
  { analyte_id: 'sperm_ph', name_ru: 'pH эякулята', panel: 'reproduction', unit_canonical: '', value_type: 'quantitative', direction: 'window', low: 7.2, high: 8.0 },
  { analyte_id: 'sperm_leuko', name_ru: 'Лейкоциты в эякуляте', panel: 'reproduction', unit_canonical: 'млн/мл', value_type: 'quantitative', direction: 'higher_worse', high: 1.0 },
  { analyte_id: 'sperm_liquefaction', name_ru: 'Время разжижения', panel: 'reproduction', unit_canonical: 'мин', value_type: 'quantitative', direction: 'higher_worse', high: 60 },
  { analyte_id: 'sperm_round_cells', name_ru: 'Круглые клетки', panel: 'reproduction', unit_canonical: 'млн/мл', value_type: 'quantitative', direction: 'higher_worse', high: 5 },
  { analyte_id: 'sperm_agglutination', name_ru: 'Агглютинация', panel: 'reproduction', unit_canonical: '', value_type: 'qualitative', direction: 'informational' },
  { analyte_id: 'sperm_color', name_ru: 'Цвет эякулята', panel: 'reproduction', unit_canonical: '', value_type: 'qualitative', direction: 'informational' },
  { analyte_id: 'sperm_mucus', name_ru: 'Слизь в эякуляте', panel: 'reproduction', unit_canonical: '', value_type: 'qualitative', direction: 'informational' },
  { analyte_id: 'tunel', name_ru: 'TUNEL (фрагментация ДНК)', panel: 'reproduction', unit_canonical: '%', value_type: 'quantitative', direction: 'higher_worse', high: 15 },
  { analyte_id: 'psa_total', name_ru: 'ПСА общий', panel: 'reproduction', unit_canonical: 'нг/мл', value_type: 'quantitative', direction: 'higher_worse', high: 4.0 },
  { analyte_id: 'psa_free', name_ru: 'ПСА свободный', panel: 'reproduction', unit_canonical: 'нг/мл', value_type: 'quantitative', direction: 'informational' },
  { analyte_id: 'psa_ratio', name_ru: 'Индекс свободного ПСА', panel: 'reproduction', unit_canonical: '%', value_type: 'quantitative', direction: 'lower_worse', low: 15 },
];

// Даты сдач лабораторных панелей (растянуты 2019–2026). Часть маркеров сдаётся не
// на всех датах — это создаёт реалистичные «дыры» и односерийные маркеры.
const LAB_DATES = [
  '2019-06-20', '2020-11-03', '2021-04-22', '2022-02-12', '2022-08-22',
  '2023-02-02', '2023-05-05', '2023-11-14', '2024-03-12', '2024-09-18',
  '2025-01-14', '2025-05-20', '2025-11-25', '2026-03-22',
];

// Детерминированный псевдо-рандом (стабильный мок между рендерами).
function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function round(v, dp) {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}

function refRawFor(d) {
  if (d.low != null && d.high != null) return `${d.low} - ${d.high}`;
  if (d.high != null) return `< ${d.high}`;
  if (d.low != null) return `> ${d.low}`;
  return null;
}

function buildLabs() {
  const rows = [];
  const dictBy = (id) => DICT.find((d) => d.analyte_id === id);

  function pushRow(id, date, valueNum, valueText, opts = {}) {
    const meta = dictBy(id);
    rows.push({
      analyte_id: id,
      panel: meta.panel,
      sample_date: date,
      seq: opts.seq ?? 0,
      value_num: valueNum ?? null,
      value_text: valueText ?? null,
      unit: meta.unit_canonical,
      ref_low: opts.low ?? meta.low ?? null,
      ref_high: opts.high ?? meta.high ?? null,
      ref_raw: opts.raw ?? refRawFor(meta),
      source: 'MOCK',
      name_ru: meta.name_ru,
      direction: meta.direction,
      value_type: meta.value_type,
    });
  }

  // ── Квант-маркеры: тренд + шум по датам (SPEC внутри DICT) ──
  DICT.forEach((d, di) => {
    if (d.value_type !== 'quantitative') return;
    if (d.base == null) return; // body/repro/psa — вручную ниже
    const rand = rng((di + 1) * 7919);
    // Односерийный маркер — только одна свежая точка (стресс-кейс).
    const dates = d.single ? ['2025-11-25'] : LAB_DATES;
    dates.forEach((date, i) => {
      const n = dates.length;
      const trend = Math.sin((i / Math.max(n - 1, 1)) * Math.PI) * d.jitter * 0.6;
      const noise = (rand() - 0.5) * 2 * d.jitter;
      let v = d.base + trend + noise;
      v = round(Math.max(v, 0.01), d.dp);
      pushRow(d.analyte_id, date, v, null);
    });
  });

  // Двойное значение (seq 0/1) на одну дату для калия — проверка обработки дублей.
  pushRow('potassium', '2025-11-25', 6.5, null, { seq: 1 });

  // Один «текстовый» квант-результат (value_num=null, value_text='<0.5') — стресс-кейс:
  // маркер quantitative, но точка без числа. Не должен ломать графики/скаттер.
  pushRow('crp', '2019-06-20', null, '< 0.5');

  // ── Серология / титры (value_num=null у qualitative) ──
  const sero = [
    { id: 'hbsag', text: 'отрицательно' },
    { id: 'anti_hcv', text: 'отрицательно' },
    { id: 'anti_hiv', text: 'отрицательно' },
    { id: 'rpr_syphilis', text: 'отрицательно' },
    { id: 'anti_tetanus_igg', num: 0.36 },
  ];
  sero.forEach((s) => pushRow(s.id, '2025-05-20', s.num ?? null, s.text ?? null));

  // ── Состав тела: 3 замера InBody — 12 ОБЩИХ параметров во всех + частичные ──
  // Общие 12 присутствуют на каждой дате (→ трендятся); частичные (вода/сегменты/ИТБ/ИОО)
  // различаются по датам (→ видны только в аккордеонах-деталях замера).
  const inbody = {
    '2023-05-05': { // InBody720 — самый полный: 12 общих + 6 частичных = 18
      bia_weight: 132.4, bia_muscle: 68.1, bia_fat_mass: 45.3, bia_fat_pct: 34.2,
      bia_protein: 17.0, bia_mineral: 5.9, bia_bmi: 40.9, bia_ideal_weight: 78.0,
      bia_weight_control: -54.4, bia_fat_control: -37.0, bia_muscle_control: 2.0, bia_fitness_score: 62,
      bia_water_tbw: 63.8, bia_water_icw: 39.5, bia_water_ecw: 24.3, bia_muscle_ra: 3.4, bia_muscle_la: 3.3, bia_whr: 0.98,
    },
    '2023-12-07': { // 12 общих + 3 частичных = 15
      bia_weight: 118.7, bia_muscle: 63.0, bia_fat_mass: 35.4, bia_fat_pct: 29.8,
      bia_protein: 15.7, bia_mineral: 5.4, bia_bmi: 36.7, bia_ideal_weight: 77.5,
      bia_weight_control: -41.2, bia_fat_control: -25.6, bia_muscle_control: 1.5, bia_fitness_score: 68,
      bia_water_tbw: 59.2, bia_bmr: 2050, bia_visceral: 138,
    },
    '2025-05-16': { // 12 общих + 2 частичных = 14
      bia_weight: 104.3, bia_muscle: 60.4, bia_fat_mass: 25.1, bia_fat_pct: 24.1,
      bia_protein: 14.9, bia_mineral: 5.1, bia_bmi: 32.2, bia_ideal_weight: 76.8,
      bia_weight_control: -27.5, bia_fat_control: -14.0, bia_muscle_control: 0.8, bia_fitness_score: 74,
      bia_bmr: 1980, bia_visceral: 112,
    },
  };
  const bodyRef = {
    bia_fat_pct: { low: 10, high: 20 },
    bia_bmi: { low: 18.5, high: 25 },
    bia_visceral: { high: 100 },
    bia_whr: { high: 0.9 },
  };
  Object.entries(inbody).forEach(([date, metrics]) => {
    Object.entries(metrics).forEach(([id, v]) => {
      const r = bodyRef[id] || {};
      pushRow(id, date, v, null, { low: r.low ?? null, high: r.high ?? null, raw: r.low != null ? `${r.low} - ${r.high}` : r.high != null ? `< ${r.high}` : null });
    });
  });

  // ── Репродукция: 3 спермограммы (2017/2019/2025) — 12 общих числовых + 2 качеств. + 1 частичный ──
  const spermByDate = {
    '2017-11-01': {
      sperm_volume: 3.1, sperm_concentration: 28, sperm_count_total: 86.8, sperm_motility_pr: 34,
      sperm_motility_total: 46, sperm_motility_np: 12, sperm_morphology: 4, sperm_vitality: 58,
      sperm_ph: 7.4, sperm_leuko: 0.6, sperm_liquefaction: 30, sperm_round_cells: 2.1,
      sperm_agglutination: 'нет', sperm_color: 'серо-опалесцирующий',
    },
    '2019-06-20': {
      sperm_volume: 3.4, sperm_concentration: 35, sperm_count_total: 119.0, sperm_motility_pr: 30,
      sperm_motility_total: 44, sperm_motility_np: 14, sperm_morphology: 3, sperm_vitality: 55,
      sperm_ph: 7.6, sperm_leuko: 0.8, sperm_liquefaction: 40, sperm_round_cells: 3.0,
      sperm_agglutination: '+', sperm_color: 'серо-опалесцирующий',
    },
    '2025-11-25': {
      sperm_volume: 3.8, sperm_concentration: 46, sperm_count_total: 174.8, sperm_motility_pr: 41,
      sperm_motility_total: 55, sperm_motility_np: 13, sperm_morphology: 5, sperm_vitality: 64,
      sperm_ph: 7.8, sperm_leuko: 0.4, sperm_liquefaction: 25, sperm_round_cells: 1.6,
      sperm_agglutination: 'нет', sperm_color: 'серо-опалесцирующий',
      sperm_mucus: 'единичные', // частичный — только в свежей дате
    },
  };
  Object.entries(spermByDate).forEach(([date, metrics]) => {
    Object.entries(metrics).forEach(([id, val]) => {
      const meta = dictBy(id);
      if (meta.value_type === 'qualitative') pushRow(id, date, null, val);
      else pushRow(id, date, val, null);
    });
  });

  // TUNEL — отдельный маркер на 2 датах (2019=16 alert, 2025=11.2 ok).
  pushRow('tunel', '2019-06-20', 16.0, null, {});
  pushRow('tunel', '2025-11-25', 11.2, null, {});

  // ПСА — ОТДЕЛЬНАЯ дата (онкопанель), не путать со спермограммой.
  pushRow('psa_total', '2025-05-20', 0.62, null, {});
  pushRow('psa_free', '2025-05-20', 0.24, null, {});
  pushRow('psa_ratio', '2025-05-20', 39, null, {});

  return rows;
}

// ── Вес: ~480 ежедневных точек 2014→2026, 206 → ~103 кг (с «горбом» COVID) ──
function buildWeight() {
  const rand = rng(424242);
  const start = new Date('2014-12-01').getTime();
  const end = new Date('2026-07-09').getTime();
  const n = 480;
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = start + ((end - start) * i) / (n - 1);
    const frac = i / (n - 1);
    // общий тренд 206 → 103 с «горбом» в середине + сезонная волна + шум
    const trend = 206 - 103 * frac + 12 * Math.sin(frac * Math.PI * 1.4) * (frac < 0.6 ? 1 : 0.25);
    const seasonal = 1.5 * Math.sin(frac * Math.PI * 22);
    const noise = (rand() - 0.5) * 3.5;
    const d = new Date(t);
    out.push({
      measure_date: d.toISOString().slice(0, 10),
      weight_kg: round(Math.min(Math.max(trend + seasonal + noise, 100), 206), 1),
    });
  }
  out.sort((a, b) => a.measure_date.localeCompare(b.measure_date));
  return out;
}

// ── Медкарта: не-лабораторные события (GET /events) ──
// group ∈ diagnoses | cardiology | imaging | surgeries
// date — YYYY-MM-DD | "2023-11" | "2014"; status ∈ active|history|resolved|null
// detail — список блоков { heading, metrics:[{k,v}], note }
function buildEvents() {
  return [
    {
      id: 'dx_thyroid_calcitonin',
      group: 'diagnoses',
      title: 'Кальцитонин ↑ — наблюдение щитовидной железы',
      date: '2023-11',
      status: 'active',
      summary: 'Стойкое повышение кальцитонина с 2023 г. на фоне повышенного Т4. Дифдиагноз C-клеточной патологии, динамическое наблюдение.',
      detail: [
        {
          heading: 'Ключевые показатели',
          metrics: [
            { k: 'Кальцитонин', v: '11.5 пг/мл (реф. < 9.52)' },
            { k: 'Т4 свободный', v: '17.6 пмоль/л (верхняя граница)' },
            { k: 'Кальций общий', v: '2.44 ммоль/л' },
          ],
          note: 'Рекомендован контроль кальцитонина каждые 6 мес + УЗИ щитовидной железы. При росте > 100 пг/мл — консультация эндокринного хирурга.',
        },
      ],
    },
    {
      id: 'dx_ldl',
      group: 'diagnoses',
      title: 'Гиперлипидемия (ЛПНП хронически > 5)',
      date: '2019-06-20',
      status: 'active',
      summary: 'Наследственно-ассоциированное повышение ЛПНП. Терапия статинами обсуждается.',
      detail: [
        {
          heading: 'Липидный профиль',
          metrics: [
            { k: 'ЛПНП', v: '5.1 ммоль/л (реф. < 3.0)' },
            { k: 'Общий холестерин', v: '6.6 ммоль/л' },
            { k: 'Аполипопротеин B', v: '1.28 г/л' },
          ],
          note: 'Целевой ЛПНП < 1.8 ммоль/л с учётом сердечно-сосудистого риска.',
        },
      ],
    },
    {
      id: 'dx_iron',
      group: 'diagnoses',
      title: 'Латентный дефицит железа',
      date: '2024-03-12',
      status: 'resolved',
      summary: 'Ферритин на нижней границе при крупной массе тела. После курса препаратов железа показатели восстановлены.',
      detail: [
        {
          heading: 'Обмен железа',
          metrics: [
            { k: 'Ферритин', v: '26 → 50 нг/мл' },
            { k: 'Железо сыворотки', v: '17 мкмоль/л' },
          ],
          note: 'Курс завершён, контроль в норме.',
        },
      ],
    },
    {
      id: 'dx_antitpo',
      group: 'diagnoses',
      title: 'Аутоиммунный тиреоидит — исключён',
      date: '2022-08-22',
      status: 'resolved',
      summary: 'Анти-ТПО снизились с 33.7 до 0.6 МЕ/мл. Аутоиммунный процесс не подтверждён.',
      detail: [
        {
          heading: 'Динамика антител',
          metrics: [
            { k: 'Анти-ТПО (2021)', v: '33.7 МЕ/мл' },
            { k: 'Анти-ТПО (2022)', v: '0.6 МЕ/мл' },
          ],
          note: '',
        },
      ],
    },
    {
      id: 'cardio_visit_2026',
      group: 'cardiology',
      title: 'Визит кардиолога — подозрение на ОРВИ-миокардит',
      date: '2026-03-05',
      status: 'active',
      summary: 'GMS Clinic, Бердников С. В. Жалобы на перебои после ОРВИ. Назначен Холтер и контроль тропонина.',
      detail: [
        {
          heading: 'Объективный статус',
          metrics: [
            { k: 'АД', v: '128/82 мм рт. ст.' },
            { k: 'ЧСС', v: '74 уд/мин' },
            { k: 'Тоны сердца', v: 'ясные, ритмичные' },
          ],
          note: 'Жалобы на перебои в работе сердца в течение 2 недель после перенесённой ОРВИ.',
        },
        {
          heading: 'ЭКГ покоя',
          metrics: [
            { k: 'Ритм', v: 'синусовый' },
            { k: 'QTc', v: '418 мс' },
            { k: 'Заключение', v: 'без острой очаговой патологии' },
          ],
          note: 'Диагноз под вопросом: I40.9 (миокардит неуточнённый). Контроль тропонина, СРБ, Холтер-ЭКГ.',
        },
      ],
    },
    {
      id: 'cardio_echo_2025',
      group: 'cardiology',
      title: 'ЭхоКГ — сократимость сохранена',
      date: '2025-05-20',
      status: 'history',
      summary: 'Фракция выброса в норме, клапанной патологии не выявлено. Незначительная гипертрофия ЛЖ.',
      detail: [
        {
          heading: 'Параметры ЭхоКГ',
          metrics: [
            { k: 'ФВ (Симпсон)', v: '61%' },
            { k: 'КДР ЛЖ', v: '52 мм' },
            { k: 'ТМЖП', v: '12 мм' },
            { k: 'Аорта', v: '34 мм' },
          ],
          note: 'Умеренная концентрическая гипертрофия миокарда левого желудочка. Диастолическая функция не нарушена.',
        },
      ],
    },
    {
      id: 'cardio_holter_2025',
      group: 'cardiology',
      title: 'Холтер-мониторинг ЭКГ (сутки)',
      date: '2025-05-21',
      status: 'history',
      summary: 'Синусовый ритм, редкая наджелудочковая экстрасистолия. Пауз и значимых аритмий не зафиксировано.',
      detail: [
        {
          heading: 'Итоги мониторинга',
          metrics: [
            { k: 'ЧСС средняя', v: '72 уд/мин' },
            { k: 'ЧСС мин / макс', v: '48 / 131 уд/мин' },
            { k: 'НЖЭС', v: '214 за сутки' },
            { k: 'ЖЭС', v: '12 за сутки' },
          ],
          note: 'Клинически значимых нарушений ритма и проводимости не выявлено.',
        },
      ],
    },
    {
      id: 'img_abdomen_2025',
      group: 'imaging',
      title: 'УЗИ органов брюшной полости',
      date: '2025-01-14',
      status: 'history',
      summary: 'Признаки жирового гепатоза. Конкрементов в желчном пузыре нет. Почки без патологии.',
      detail: [
        {
          heading: 'Печень',
          metrics: [
            { k: 'Размер (КВР)', v: '162 мм' },
            { k: 'Эхогенность', v: 'повышена' },
            { k: 'Структура', v: 'диффузно неоднородная' },
          ],
          note: 'УЗ-картина стеатоза печени I–II ст. Рекомендована коррекция веса и контроль печёночных ферментов.',
        },
        {
          heading: 'Почки и селезёнка',
          metrics: [
            { k: 'Почки', v: 'без конкрементов' },
            { k: 'Селезёнка', v: '108 × 44 мм, норма' },
          ],
          note: '',
        },
      ],
    },
    {
      id: 'img_medosmotr_2026',
      group: 'imaging',
      title: 'Профилактический медосмотр',
      date: '2026-05-18',
      status: 'history',
      summary: 'Терапевт, окулист, ЛОР — без острой патологии. Рекомендовано наблюдение по кардиологии и эндокринологии.',
      detail: [
        {
          heading: 'Осмотр терапевта',
          metrics: [
            { k: 'Рост / вес', v: '182 см / 103 кг' },
            { k: 'ИМТ', v: '31.1 кг/м²' },
            { k: 'АД', v: '126/80 мм рт. ст.' },
          ],
          note: 'Ожирение I ст. Направлен к профильным специалистам для планового наблюдения.',
        },
      ],
    },
    {
      id: 'surg_appendectomy',
      group: 'surgeries',
      title: 'Аппендэктомия',
      date: '2003',
      status: 'history',
      summary: 'Лапароскопическое удаление червеобразного отростка по поводу острого аппендицита. Без осложнений.',
      detail: [
        {
          heading: 'Операция',
          metrics: [
            { k: 'Доступ', v: 'лапароскопический' },
            { k: 'Осложнения', v: 'нет' },
          ],
          note: 'Послеоперационный период гладкий, выписан на 4-е сутки.',
        },
      ],
    },
    {
      id: 'surg_septoplasty',
      group: 'surgeries',
      title: 'Септопластика',
      date: '2016-10',
      status: 'history',
      summary: 'Коррекция искривления носовой перегородки. Носовое дыхание восстановлено.',
      detail: [
        {
          heading: 'Вмешательство',
          metrics: [
            { k: 'Тип', v: 'эндоскопическая септопластика' },
            { k: 'Анестезия', v: 'общая' },
          ],
          note: '',
        },
      ],
    },
  ];
}

export function buildMockData() {
  return {
    labs: buildLabs(),
    weight: buildWeight(),
    dictionary: DICT,
    events: buildEvents(),
    health: {
      status: 'ok',
      labs_count: 0, // заполнится ниже
      weight_count: 0,
      analytes_count: DICT.length,
      last_ingest: '2026-03-22T09:14:00Z',
    },
  };
}

// Финальная сборка с корректными счётчиками.
export function mockData() {
  const d = buildMockData();
  d.health.labs_count = d.labs.length;
  d.health.weight_count = d.weight.length;
  return d;
}
