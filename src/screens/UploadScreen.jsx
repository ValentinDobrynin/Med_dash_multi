import { useRef, useState, useCallback } from 'react';
import { T } from '../theme.js';
import { uploadLabPdf, confirmLabPdf, cancelLabPdf } from '../api.js';

// Вкладка «Загрузить анализы». Пакетная загрузка: выбор нескольких PDF или
// перетаскивание из Finder/Explorer. Каждый файл — своя карточка-превью со своим
// подтверждением; сверху «Залить все». Только PDF-анализы с текстовым слоем.
let _uid = 0;

export default function UploadScreen({ onCommitted }) {
  const [items, setItems] = useState([]); // {id,name,phase,preview,message,dup,error}
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const patch = (id, p) => setItems((xs) => xs.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const addFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!files.length) return;
    const created = files.map((f) => ({
      id: ++_uid, name: f.name, phase: 'uploading', preview: null, message: '', dup: false, error: '',
    }));
    setItems((xs) => [...xs, ...created]);
    await Promise.all(created.map(async (it, i) => {
      try {
        const pv = await uploadLabPdf(files[i]);
        patch(it.id, { phase: pv.ok ? 'preview' : 'reject', preview: pv });
      } catch (e) {
        patch(it.id, { phase: 'error', error: String(e.message || e) });
      }
    }));
  }, []);

  const onPick = (e) => { addFiles(e.target.files); if (inputRef.current) inputRef.current.value = ''; };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer?.files); };
  const onDragOver = (e) => { e.preventDefault(); if (!drag) setDrag(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDrag(false); };

  async function confirmItem(it, refresh = true) {
    if (!it.preview?.pending_id) return false;
    patch(it.id, { phase: 'committing' });
    try {
      const r = await confirmLabPdf(it.preview.pending_id);
      const dupOnly = (r.inserted ?? 0) === 0 && (r.changed ?? 0) === 0;
      patch(it.id, { phase: 'done', message: r.message || 'Залито.', dup: dupOnly });
      if (!dupOnly && refresh) onCommitted?.();
      return !dupOnly;
    } catch (e) {
      patch(it.id, { phase: 'error', error: String(e.message || e) });
      return false;
    }
  }

  async function cancelItem(it) {
    if (it.preview?.pending_id) { try { await cancelLabPdf(it.preview.pending_id); } catch { /* игнор */ } }
    setItems((xs) => xs.filter((x) => x.id !== it.id));
  }

  async function confirmAll() {
    const pending = items.filter((it) => it.phase === 'preview');
    let any = false;
    for (const it of pending) { any = (await confirmItem(it, false)) || any; }
    if (any) onCommitted?.();
  }

  const clearDone = () => setItems((xs) => xs.filter((it) => it.phase !== 'done' && it.phase !== 'reject' && it.phase !== 'error'));

  const pendingCount = items.filter((it) => it.phase === 'preview').length;
  const busy = items.some((it) => it.phase === 'uploading' || it.phase === 'committing');
  const doneCount = items.filter((it) => it.phase === 'done').length;

  return (
    <div onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
      <h2 style={{ fontFamily: T.fontDisplay, fontStyle: 'italic', fontWeight: 500, color: T.ink, fontSize: 22, margin: '0 0 6px' }}>
        Загрузить анализы
      </h2>
      <p style={{ color: T.inkMuted, fontSize: 13, marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
        Выбери или перетащи один или несколько PDF — сервер распознает показатели и покажет превью по
        каждому. Заливка в дэш — только после подтверждения.{' '}
        <span style={{ color: T.inkSoft }}>
          Поддерживаются только PDF-анализы с текстовым слоем (не сканы-картинки и не выписки/заключения).
        </span>
      </p>

      {/* Зона выбора / перетаскивания */}
      <label
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '30px 20px', borderRadius: 16, cursor: 'pointer', textAlign: 'center',
          background: drag ? 'rgba(129,140,248,0.12)' : T.card,
          border: `1.5px dashed ${drag ? T.accent : T.border}`, color: T.inkSoft,
          transition: 'background 120ms, border-color 120ms',
        }}
      >
        <PdfIcon />
        <div style={{ fontSize: 15, color: T.ink }}>
          {drag ? 'Отпусти файлы здесь' : 'Перетащи PDF сюда или нажми, чтобы выбрать'}
        </div>
        <div style={{ fontSize: 12, color: T.inkMuted, fontFamily: T.fontMono }}>можно несколько файлов сразу</div>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple onChange={onPick} style={{ display: 'none' }} />
      </label>

      {/* Верхняя панель действий */}
      {items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button onClick={confirmAll} disabled={pendingCount === 0 || busy} style={btn(true, pendingCount === 0 || busy)}>
            ⤓ Залить все{pendingCount ? ` (${pendingCount})` : ''}
          </button>
          <span style={{ color: T.inkMuted, fontSize: 12, fontFamily: T.fontMono }}>
            файлов: {items.length} · готово к заливке: {pendingCount} · залито: {doneCount}
          </span>
          {(doneCount > 0 || items.some((it) => it.phase === 'reject' || it.phase === 'error')) && (
            <button onClick={clearDone} style={{ ...btn(false), marginTop: 0, marginLeft: 'auto' }}>Убрать завершённые</button>
          )}
        </div>
      )}

      {/* Карточки по файлам */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        {items.map((it) => (
          <Card key={it.id} it={it} onConfirm={() => confirmItem(it)} onCancel={() => cancelItem(it)} />
        ))}
      </div>
    </div>
  );
}

function Card({ it, onConfirm, onCancel }) {
  const pv = it.preview;
  const markers = pv?.rows ? pv.rows.map((r) => r.name_ru || r.analyte_id) : [];
  const bar = statusBar(it);
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, background: T.card, border: `1px solid ${bar.border}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ color: T.ink, fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{it.name}</div>
        <span style={{ color: bar.color, fontSize: 12, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>{bar.label}</span>
      </div>

      {it.phase === 'preview' && pv && (
        <>
          <div style={{ marginTop: 6, color: T.inkSoft, fontSize: 13 }}>
            <span style={{ fontFamily: T.fontMono, color: T.accent }}>{pv.row_count} значений</span>
            {' · '}{(pv.dates || []).join(', ')}
            {pv.used_fallback ? ' · 🤖 fallback' : ''}
          </div>
          <div style={{ marginTop: 4, color: T.inkMuted, fontSize: 12.5, lineHeight: 1.45 }}>
            {markers.slice(0, 12).join(', ')}{markers.length > 12 ? ` … (+${markers.length - 12})` : ''}
          </div>
          {pv.rejects?.length > 0 && (
            <div style={{ marginTop: 4, color: '#fcd34d', fontSize: 12 }}>
              не распознано: {[...new Set(pv.rejects.map((r) => r.name))].slice(0, 8).join(', ')}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={onConfirm} style={btn(true)}>Подтвердить</button>
            <button onClick={onCancel} style={{ ...btn(false), marginTop: 0 }}>Отмена</button>
          </div>
        </>
      )}

      {it.phase === 'reject' && pv && (
        <div style={{ marginTop: 6, color: '#fcd34d', fontSize: 13, whiteSpace: 'pre-wrap' }}>{pv.summary}</div>
      )}
      {it.phase === 'error' && (
        <div style={{ marginTop: 6, color: '#fca5a5', fontSize: 13 }}>{it.error}</div>
      )}
      {it.phase === 'done' && (
        <div style={{ marginTop: 6, fontSize: 13, color: it.dup ? '#a5b4fc' : '#6ee7b7' }}>{it.message}</div>
      )}
    </div>
  );
}

function statusBar(it) {
  switch (it.phase) {
    case 'uploading': return { label: 'разбираю…', color: T.inkMuted, border: T.border };
    case 'committing': return { label: 'заливаю…', color: T.inkMuted, border: T.accent };
    case 'preview': return { label: 'готово к заливке', color: T.accent, border: T.accent };
    case 'done': return { label: it.dup ? 'уже в системе' : 'залито ✓', color: it.dup ? '#a5b4fc' : '#6ee7b7', border: it.dup ? 'rgba(129,140,248,0.4)' : 'rgba(52,211,153,0.4)' };
    case 'reject': return { label: 'не анализ', color: '#fcd34d', border: 'rgba(251,191,36,0.4)' };
    case 'error': return { label: 'ошибка', color: '#fca5a5', border: 'rgba(248,113,113,0.4)' };
    default: return { label: '', color: T.inkMuted, border: T.border };
  }
}

function btn(primary, disabled = false) {
  return {
    marginTop: primary ? 0 : 0, padding: '9px 16px', borderRadius: 10, fontSize: 13.5,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
    background: primary ? 'rgba(129,140,248,0.16)' : T.card,
    border: `1px solid ${primary ? T.accent : T.border}`,
    color: primary ? T.accent : T.inkSoft,
  };
}

function PdfIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" stroke={T.accent} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke={T.accent} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 11v6M9 14h6" stroke={T.accent} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
