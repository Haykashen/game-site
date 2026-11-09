import { Trophy } from 'lucide-react';
import vaultArt from '../assets/discvault-vault.svg';
import { PageHeading } from '../components/PageHeading';
import { SectionPlaceholder } from '../components/SectionPlaceholder';

export function AchievementsPage() {
  return <>
    <PageHeading eyebrow="MY SHELF / ACHIEVEMENTS" title="Достижения" description="Награды за серии, регионы и коллекционные издания на вашей полке." />
    <SectionPlaceholder icon={Trophy} title="Достижения коллекционера в разработке"
      description="Здесь появятся награды за пополнение коллекции, собранные серии и редкие издания."
      chips={['Серии', 'Регионы', 'Коллекционные издания', 'Пополнение коллекции']}
      artwork={{ src: vaultArt, alt: 'Хранилище физических изданий DiscVault' }} />
  </>;
}