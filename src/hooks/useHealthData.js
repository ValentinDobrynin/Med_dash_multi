import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAll } from '../api.js';
import { mockData } from '../mockData.js';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1';

// Кэш в памяти на сессию (без localStorage/sessionStorage — ТЗ §5).
let memoryCache = null;

// Хук данных: fetch четырёх эндпоинтов при маунте, состояния loading/error,
// кнопка refresh перезапрашивает и обновляет кэш.
export function useHealthData() {
  const [state, setState] = useState({
    status: memoryCache ? 'ready' : 'loading', // loading | error | ready
    data: memoryCache,
    error: null,
  });
  const mounted = useRef(true);

  const load = useCallback(async (force) => {
    if (memoryCache && !force) {
      setState({ status: 'ready', data: memoryCache, error: null });
      return;
    }
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      let data;
      if (USE_MOCK) {
        await new Promise((r) => setTimeout(r, 350)); // имитируем сеть
        data = mockData();
      } else {
        data = await fetchAll();
      }
      memoryCache = data;
      if (mounted.current) setState({ status: 'ready', data, error: null });
    } catch (err) {
      if (mounted.current) {
        setState({ status: 'error', data: memoryCache, error: err });
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load(false);
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => {
    memoryCache = null;
    load(true);
  }, [load]);

  return { ...state, refresh, isMock: USE_MOCK };
}
