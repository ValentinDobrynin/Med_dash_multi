import { T } from '../theme.js';
import { formatNum, formatDate } from '../utils.js';
import { usePrivacy, pStatus, MASK } from '../privacy.jsx';
import Sparkline from './Sparkline.jsx';

// Sparkline-карточка маркера (Screen B trend-грид). Тап → модалка.
export default function MarkerCard({ marker, onTap }) {
  const priv = usePrivacy();
  const c = pStatus(priv, marker.status);
  const value = marker.last?.value;
  const prev = marker.prev?.value;
  const delta = prev != null && value != null ? value - prev : null;
  const deltaPct = delta != null && prev !== 0 ? (delta / prev) * 100 : null;

  const isBad = (() => {
    if (delta == null) return false;
    if (marker.direction === 'higher_worse') return delta > 0;
    if (marker.direction === 'lower_worse') return delta < 0;
    return false;
  })();

  return (
    <button
      onClick={() => onTap(marker)}
      className="tap"
      style={{
        position: 'relative', textAlign: 'left', borderRadius: 12, padding: 12,
        background: T.card, border: `1px solid ${c.border}`,
        boxShadow: !priv && marker.status === 'alert' ? `inset 3px 0 0 ${c.fg}` : 'none',
        transition: 'filter 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.12)')}
      onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: T.ink, fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 500, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {marker.name_ru}
          </div>
          <div style={{ color: T.inkMuted, fontSize: 9, marginTop: 2 }}>{marker.unit}</div>
        </div>
        <span style={{ width: 6, height: 6, borderRadius: 6, background: c.fg, boxShadow: priv ? 'none' : `0 0 8px ${c.fg}`, marginTop: 4, flexShrink: 0 }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <div style={{ color: c.fg, fontFamily: T.fontMono, fontWeight: 500, fontSize: 26, lineHeight: 1, letterSpacing: '-0.01em' }}>
          {priv ? MASK : value != null ? formatNum(value) : marker.last?.valueText || '—'}
        </div>
        {!priv && delta != null && Math.abs(deltaPct) >= 1 && (
          <div style={{ color: isBad ? '#fbbf24' : T.inkMuted, fontFamily: T.fontMono, fontSize: 10 }}>
            {delta > 0 ? '+' : ''}{formatNum(delta)}
          </div>
        )}
      </div>

      <div style={{ margin: '0 -4px' }}>
        <Sparkline marker={marker} />
      </div>

      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: T.inkMuted, fontSize: 9 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{priv ? '' : marker.refRaw || ''}</span>
        {marker.last?.date && (
          <span style={{ fontFamily: T.fontMono, flexShrink: 0, marginLeft: 4 }}>{formatDate(marker.last.date)}</span>
        )}
      </div>
    </button>
  );
}
