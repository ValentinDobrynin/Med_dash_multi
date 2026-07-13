// Режим приватности (правка №4). Без localStorage — только React-состояние.
// Скрывает числовые значения (→ «•••») и нейтрализует статус-раскраску.
import { createContext, useContext } from 'react';
import { STATUS_COLORS } from './theme.js';
import { formatNum } from './utils.js';

export const PrivacyContext = createContext(false);
export const usePrivacy = () => useContext(PrivacyContext);

// Плейсхолдер для скрытого значения.
export const MASK = '•••';

// Число с учётом приватности.
export function dispNum(priv, v) {
  return priv ? MASK : formatNum(v);
}

// Произвольный текст-значение с учётом приватности.
export function dispText(priv, t) {
  return priv ? MASK : t;
}

// Набор статус-цветов: в приватном режиме всё нейтрально-серое.
export function pStatus(priv, status) {
  return priv ? STATUS_COLORS.none : STATUS_COLORS[status] || STATUS_COLORS.none;
}
