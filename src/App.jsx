import { Component, useCallback, useEffect, useState } from 'react';
import { T } from './theme.js';
import { formatIngest } from './utils.js';
import { useHealthData } from './hooks/useHealthData.js';
import { PrivacyContext } from './privacy.jsx';
import { MeContext } from './me.jsx';
import { fetchMe, logout } from './api.js';
import AuthScreen from './screens/AuthScreen.jsx';
import LabsScreen from './screens/LabsScreen.jsx';
import WeightScreen from './screens/WeightScreen.jsx';
import UploadScreen from './screens/UploadScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';
import AdminScreen from './screens/AdminScreen.jsx';
import WeightQuickAdd from './components/WeightQuickAdd.jsx';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1';
const MOCK_ME = { login: 'mock', name: 'Mock', role: 'user',
                  bot: { connected: false, username: null, bound: false } };

// Auth-гейт (PLAN_multiuser v3 §6): /auth/me → либо экран входа, либо кабинет.
export default function App() {
  const [me, setMe] = useState(undefined); // undefined=проверяем, null=гость
  const refreshMe = useCallback(async () => {
    if (USE_MOCK) { setMe(MOCK_ME); return; }
    try {
      setMe(await fetchMe());
    } catch {
      setMe(null);
    }
  }, []);
  useEffect(() => { refreshMe(); }, [refreshMe]);

  if (me === undefined) {
    return (
      <div className="container" style={{ paddingTop: 60 }}>
        <div className="skeleton" style={{ height: 44, marginBottom: 16, maxWidth: 420 }} />
        <div className="skeleton" style={{ height: 200, maxWidth: 420 }} />
      </div>
    );
  }
  if (!me) return <AuthScreen onAuthed={refreshMe} />;

  return (
    <MeContext.Provider value={me}>
      <Dashboard me={me} refreshMe={refreshMe}
                 onLogout={async () => { try { await logout(); } finally { setMe(null); } }} />
    </MeContext.Provider>
  );
}

function Dashboard({ me, refreshMe, onLogout }) {
  const { status, data, error, refresh, isMock } = useHealthData();
  const [tab, setTab] = useState('labs'); // labs | weight | upload | settings | admin
  const [privacy, setPrivacy] = useState(false);
  const [botBannerHidden, setBotBannerHidden] = useState(false);

  const labsCount = data?.labs?.length ?? 0;
  const analytesCount = data?.dictionary?.length ?? 0;
  const lastIngest = data?.labs?.length
    ? data.labs.reduce((m, r) => (r.ingested_at > m ? r.ingested_at : m), '')
    : null;

  const emptyState = status === 'ready' && labsCount === 0;
  const showBotBanner = !botBannerHidden && !me.bot?.connected && status === 'ready' && !emptyState;

  const tabs = [
    { id: 'labs', label: 'Анализы' },
    { id: 'weight', label: 'Аналитика и динамика' },
    { id: 'upload', label: 'Загрузить анализы' },
    { id: 'settings', label: 'Настройки' },
    ...(me.role === 'admin' ? [{ id: 'admin', label: 'Админка' }] : []),
  ];

  return (
    <PrivacyContext.Provider value={privacy}>
      <div className="container">
        {/* HEADER */}
        <header style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ color: T.inkMuted, fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 6 }}>
                Здоровье · панель{isMock ? ' · mock' : ''}
              </div>
              <h1 style={{ fontFamily: T.fontDisplay, fontWeight: 500, fontStyle: 'italic', color: T.ink, fontSize: 30, lineHeight: 1.05, margin: 0 }}>
                {me.name}
              </h1>
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => setPrivacy((v) => !v)}
                title={privacy ? 'Показать значения' : 'Скрыть значения'}
                aria-label={privacy ? 'Показать значения' : 'Скрыть значения'}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 10,
                  background: privacy ? 'rgba(129,140,248,0.16)' : T.card,
                  border: `1px solid ${privacy ? T.accent : T.border}`,
                  color: privacy ? T.accent : T.inkSoft,
                }}
              >
                <EyeIcon closed={privacy} />
              </button>

              <button
                onClick={refresh}
                disabled={status === 'loading'}
                title="Обновить данные"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 14px', height: 42, borderRadius: 10,
                  background: T.card, border: `1px solid ${T.border}`, color: T.inkSoft, fontFamily: T.fontMono, fontSize: 12,
                  opacity: status === 'loading' ? 0.7 : 1,
                }}
              >
                <RefreshIcon spinning={status === 'loading'} />
                <span>обновить</span>
              </button>

              <button
                onClick={onLogout}
                title="Выйти"
                style={{
                  display: 'inline-flex', alignItems: 'center', padding: '0 14px', height: 42, borderRadius: 10,
                  background: T.card, border: `1px solid ${T.border}`, color: T.inkMuted, fontFamily: T.fontMono, fontSize: 12,
                }}
              >
                выйти
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 12, color: T.inkMuted, fontSize: 11 }}>
            {status === 'ready' && (
              <>
                <span style={{ fontFamily: T.fontMono }}>{labsCount} измерений</span>
                <span style={{ color: T.border }}>·</span>
                <span style={{ fontFamily: T.fontMono }}>{analytesCount} маркеров</span>
                {lastIngest && (
                  <>
                    <span style={{ color: T.border }}>·</span>
                    <span>
                      обновлено:{' '}
                      <span style={{ color: T.accent, fontFamily: T.fontMono }}>{formatIngest(lastIngest)}</span>
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
            {tabs.map((tb) => {
              const active = tab === tb.id;
              return (
                <button
                  key={tb.id}
                  onClick={() => setTab(tb.id)}
                  className="tap"
                  aria-pressed={active}
                  style={{
                    padding: '12px 22px', borderRadius: 999, fontSize: 14, fontFamily: T.fontBody, fontWeight: 500,
                    background: active ? 'rgba(129,140,248,0.16)' : T.card,
                    border: `1px solid ${active ? T.accent : T.border}`,
                    color: active ? T.accent : T.inkSoft,
                  }}
                >
                  {tb.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* Онбординг §6.1: skippable-баннер бота — НЕ первый шаг, просто удобство */}
        {showBotBanner && tab !== 'settings' && (
          <div style={{
            marginBottom: 16, padding: '12px 16px', borderRadius: 12, fontSize: 13,
            background: 'rgba(129,140,248,0.08)', border: `1px solid ${T.border}`,
            color: T.inkSoft, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <span>Хочешь присылать анализы и вес с телефона — подключи своего Telegram-бота.</span>
            <button onClick={() => setTab('settings')}
                    style={{ background: 'none', border: 'none', color: T.accent, textDecoration: 'underline', fontSize: 13 }}>
              подключить
            </button>
            <button onClick={() => setBotBannerHidden(true)}
                    style={{ background: 'none', border: 'none', color: T.inkMuted, fontSize: 13, marginLeft: 'auto' }}>
              позже ✕
            </button>
          </div>
        )}

        {/* BODY */}
        {status === 'loading' && !data && <LoadingSkeleton />}
        {status === 'error' && !data && <ErrorState error={error} onRetry={refresh} />}
        {data && (
          <>
            {status === 'error' && (
              <div
                style={{
                  marginBottom: 16, padding: '10px 14px', borderRadius: 10, fontSize: 12,
                  background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5',
                }}
              >
                Обновление не удалось ({String(error?.message || error)}). Показаны прошлые данные.{' '}
                <button onClick={refresh} style={{ color: '#fca5a5', textDecoration: 'underline', background: 'none', border: 'none' }}>
                  повторить
                </button>
              </div>
            )}

            {/* Пустое состояние: первый успех — загруженный PDF (§6.1) */}
            {emptyState && tab === 'labs' && (
              <div style={{
                padding: 32, borderRadius: 14, textAlign: 'center', marginBottom: 16,
                background: T.card, border: `1px dashed ${T.border}`,
              }}>
                <div style={{ fontFamily: T.fontDisplay, fontStyle: 'italic', fontSize: 22, color: T.ink, marginBottom: 8 }}>
                  Загрузи свой первый анализ
                </div>
                <div style={{ color: T.inkSoft, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                  PDF из лаборатории с текстовым слоем — я разберу значения и построю графики.
                  <br />Telegram-бот не обязателен: всё работает прямо здесь.
                </div>
                <button onClick={() => setTab('upload')} className="tap"
                        style={{ padding: '12px 26px', borderRadius: 10, fontSize: 15,
                                 background: 'rgba(129,140,248,0.16)', border: `1px solid ${T.accent}`, color: T.accent }}>
                  Загрузить PDF
                </button>
              </div>
            )}

            <ErrorBoundary key={tab}>
              {tab === 'labs' && !emptyState && <LabsScreen data={data} />}
              {tab === 'weight' && (
                <>
                  <WeightQuickAdd onAdded={refresh} />
                  <WeightScreen data={data} />
                </>
              )}
              {tab === 'upload' && <UploadScreen onCommitted={refresh} />}
              {tab === 'settings' && <SettingsScreen me={me} refreshMe={refreshMe} />}
              {tab === 'admin' && me.role === 'admin' && <AdminScreen />}
            </ErrorBoundary>
          </>
        )}
      </div>
    </PrivacyContext.Provider>
  );
}

// Страховка рендера: ошибка внутри экрана не делает пустой/белый экран,
// а показывает сообщение + кнопку перезагрузки. Ремаунтится по key={tab}.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Лог в консоль для диагностики; наружу ничего не отправляем (личные данные).
    console.error('Ошибка рендера экрана:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 28, borderRadius: 14, textAlign: 'center',
            background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.28)',
          }}
        >
          <div style={{ color: '#f87171', fontFamily: T.fontDisplay, fontSize: 20, marginBottom: 8 }}>
            Не удалось отрисовать экран
          </div>
          <div style={{ color: T.inkSoft, fontSize: 13, marginBottom: 16, fontFamily: T.fontMono, wordBreak: 'break-word' }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '9px 20px', borderRadius: 10, background: 'rgba(248,113,113,0.16)', border: '1px solid rgba(248,113,113,0.4)', color: '#fca5a5', fontSize: 13 }}
          >
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RefreshIcon({ spinning }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      className={spinning ? 'spin' : undefined}
      style={{ display: 'block' }}
    >
      <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-8.5-6" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 8.5 6" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20.5 3v4.2h-4.2" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 21v-4.2h4.2" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon({ closed }) {
  if (closed) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M9.4 5.2A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7 0 .9-.7 2.2-1.9 3.4M6.1 6.6C3.9 8 2 10.3 2 12c0 2.5 4 7 10 7 1.6 0 3-.3 4.3-.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="skeleton" style={{ height: 44, marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div className="skeleton" style={{ flex: 1, height: 52 }} />
        <div className="skeleton" style={{ flex: 1, height: 52 }} />
        <div className="skeleton" style={{ flex: 1, height: 52 }} />
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton" style={{ height: 64, marginBottom: 8 }} />
      ))}
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div
      style={{
        padding: 28, borderRadius: 14, textAlign: 'center',
        background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.28)',
      }}
    >
      <div style={{ color: '#f87171', fontFamily: T.fontDisplay, fontSize: 20, marginBottom: 8 }}>Не удалось загрузить данные</div>
      <div style={{ color: T.inkSoft, fontSize: 13, marginBottom: 16, fontFamily: T.fontMono }}>{String(error?.message || error)}</div>
      <button
        onClick={onRetry}
        style={{ padding: '9px 20px', borderRadius: 10, background: 'rgba(248,113,113,0.16)', border: '1px solid rgba(248,113,113,0.4)', color: '#fca5a5', fontSize: 13 }}
      >
        Повторить
      </button>
    </div>
  );
}
