import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { usePrivacy, pStatus } from '../privacy.jsx';

// Мини-график для карточки маркера (Screen B trend-грид).
// В приватном режиме форма линии остаётся, цвет нейтральный (правка №4).
export default function Sparkline({ marker, height = 38 }) {
  const priv = usePrivacy();
  const data = marker.points.filter((p) => p.value != null).map((p) => ({ v: p.value }));
  const color = pStatus(priv, marker.status).fg;

  if (data.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 6, background: color }} />
        <span style={{ color: 'var(--ink-muted)', fontSize: 10 }}>1 точка</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
