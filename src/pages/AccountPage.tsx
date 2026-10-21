import { Star, UserRound } from 'lucide-react';
import { PageHeading } from '../components/PageHeading';
import { SpecRow } from '../components/ui/SpecRow';

/** Profile shell: fields and rating are placeholders until auth lands. */
export function AccountPage() {
  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT / PROFILE"
        title="Аккаунт"
        description="Профиль коллекционера, рейтинг и отзывы после сделок."
      />

      <div className="panel profile-panel">
        <div className="profile-head">
          <div className="profile-avatar">
            <UserRound size={28} aria-hidden="true" />
          </div>
          <div className="profile-meta">
            <p className="profile-name">Гость</p>
            <p className="profile-sub">Локальный профиль · авторизация появится позже</p>
          </div>
          <span className="profile-rating">
            <Star size={14} aria-hidden="true" />
            Нет рейтинга
          </span>
        </div>

        <div className="profile-columns">
          <div className="spec-box">
            <h4>Профиль</h4>
            <SpecRow label="Никнейм" value="—" />
            <SpecRow label="Почта" value="—" />
            <SpecRow label="Телефон" value="—" />
          </div>
          <div className="spec-box">
            <h4>Доставка и рейтинг</h4>
            <SpecRow label="Адрес" value="—" />
            <SpecRow label="Отзывы" value="Пока нет" />
            <SpecRow label="Сделки" value="0" />
          </div>
        </div>
      </div>
    </>
  );
}
