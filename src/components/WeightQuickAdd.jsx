import { useState } from 'react';
import { T } from '../theme.js';
import { addWeightEntry } from '../api.js';

// Ручной ввод веса с дэша (PLAN_multiuser v3 §5.5 — работает без бота).
export default function WeightQuickAdd({ onAdded }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const val = parseFloat(String(kg).replace(',', '.'));
    if (!Number.isFinite(val)) { setMsg({ ok: false, text: 'вес — число' }); return; }
    setBusy(true); setMsg(null);
    try {
      await addWeightEntry(date, val);
      setMsg({ ok: true, text: `✓ ${val} кг · ${date}` });
      setKg('');
      onAdded?.();
    } catch (err) {
      setMsg({ ok: false, text: String(err.message || err) });
    } finally { setBusy(false); }
  };

  const input = {
    padding: '9px 12px', borderRadius: 10, fontSize: 13, background: T.card,
    border: `1px solid ${T.border}`, color: T.ink, fontFamily: T.fontMono, outline: 'none',
  };

  return (
    <form onSubmit={submit}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      <span style={{ color: T.inkMuted, fontSize: 12 }}>Записать вес:</span>
      <input style={{ ...input, width: 130 }} type="date" value={date} max={today}
             onChange={(e) => setDate(e.target.value)} required />
      <input style={{ ...input, width: 90 }} inputMode="decimal" placeholder="кг"
             value={kg} onChange={(e) => setKg(e.target.value)} required />
      <button type="submit" className="tap" disabled={busy}
              style={{ padding: '9px 16px', borderRadius: 10, fontSize: 13,
                       background: 'rgba(129,140,248,0.16)', border: `1px solid ${T.accent}`,
                       color: T.accent, opacity: busy ? 0.6 : 1 }}>
        Сохранить
      </button>
      {msg && <span style={{ fontSize: 12, color: msg.ok ? '#34d399' : '#fca5a5' }}>{msg.text}</span>}
    </form>
  );
}
