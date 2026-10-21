import { PageHeading } from '../components/PageHeading';
import { Tabs } from '../components/ui/Tabs';
import type { TabItem } from '../components/ui/Tabs';
import { useThemeContext } from '../context/ThemeContext';
import type { Theme } from '../types';

const THEME_TABS: ReadonlyArray<TabItem<Theme>> = [
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' },
];

export function SettingsPage() {
  const { theme, setTheme } = useThemeContext();

  return (
    <>
      <PageHeading
        eyebrow="SYSTEM / SETTINGS"
        title="Настройки"
        description="Тема оформления, язык интерфейса и будущие параметры аккаунта."
      />

      <div className="settings-list">
        <div className="settings-row">
          <div className="settings-copy">
            <p className="settings-title">Тема</p>
            <p className="settings-hint">Светлое или тёмное оформление интерфейса.</p>
          </div>
          <Tabs
            items={THEME_TABS}
            value={theme}
            onChange={setTheme}
            containerClassName="view-mode-tabs"
            buttonClassName="view-mode-btn"
            ariaLabel="Тема оформления"
          />
        </div>

        <div className="settings-row">
          <div className="settings-copy">
            <p className="settings-title">Язык</p>
            <p className="settings-hint">Язык интерфейса и подписей в каталоге.</p>
          </div>
          <span className="settings-value">Русский</span>
        </div>

        <div className="settings-row">
          <div className="settings-copy">
            <p className="settings-title">Валюта</p>
            <p className="settings-hint">Отображение цен в лотах и статистике.</p>
          </div>
          <span className="settings-value">₽ · RUB</span>
        </div>

        <div className="settings-row">
          <div className="settings-copy">
            <p className="settings-title">Уведомления</p>
            <p className="settings-hint">Письма о новых лотах и ставках.</p>
          </div>
          <span className="settings-value settings-value--muted">Скоро</span>
        </div>
      </div>
    </>
  );
}
