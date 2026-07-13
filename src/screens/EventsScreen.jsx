import MedRecordSection from '../components/MedRecordSection.jsx';

// Screen D — «Медкарта»: не-лабораторные события (GET /events) на всю ширину.
// Раньше MedRecordSection жил подвалом на экране «Анализы»; теперь это отдельный
// равноправный таб. Пустые/незагруженные данные → мягкий плейсхолдер (внутри
// MedRecordSection при standalone).
export default function EventsScreen({ data }) {
  return (
    <div className="animate-fadeIn">
      <MedRecordSection events={data?.events} standalone />
    </div>
  );
}
