import { BarChart3 } from 'lucide-react';
import { PageHeading } from '../components/PageHeading';
import { SectionPlaceholder } from '../components/SectionPlaceholder';

export function StatsPage() {
  return (
    <>
      <PageHeading
        eyebrow="SHELF / ANALYTICS"
        title="Статистика"
        description="Стоимость коллекции, распределение по платформам и динамика цен."
      />
      <SectionPlaceholder
        icon={BarChart3}
        title="Аналитика коллекции в разработке"
        description="Диаграммы будут строиться по вашей полке и лотам каталога — без ручного ввода."
        chips={['Стоимость коллекции', 'Платформы', 'Серии', 'Динамика цен']}
      />
    </>
  );
}
