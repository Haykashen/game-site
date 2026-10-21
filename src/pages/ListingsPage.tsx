import { Tag } from 'lucide-react';
import { PageHeading } from '../components/PageHeading';
import { SectionPlaceholder } from '../components/SectionPlaceholder';

export function ListingsPage() {
  return (
    <>
      <PageHeading
        eyebrow="MARKET / LISTINGS"
        title="Объявления"
        description="Продажа, покупка и обмен изданиями между коллекционерами."
      />
      <SectionPlaceholder
        icon={Tag}
        title="Доска объявлений скоро появится"
        description="Здесь можно будет выставить издание, найти нужный лот или предложить обмен с доплатой."
        chips={['Продажа', 'Покупка', 'Обмен', 'Состояние']}
      />
    </>
  );
}
