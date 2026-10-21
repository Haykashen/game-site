import { Gavel } from 'lucide-react';
import { PageHeading } from '../components/PageHeading';
import { SectionPlaceholder } from '../components/SectionPlaceholder';

export function AuctionsPage() {
  return (
    <>
      <PageHeading
        eyebrow="MARKET / AUCTIONS"
        title="Аукционы"
        description="Торги за редкие издания: ставки, продавцы и время до закрытия лота."
      />
      <SectionPlaceholder
        icon={Gavel}
        title="Аукционы скоро откроются"
        description="Раздел будет собирать активные торги с фильтрами по типу издания, региону и платформе."
        chips={['Тип издания', 'Регион', 'Платформа', 'Таймер']}
      />
    </>
  );
}
