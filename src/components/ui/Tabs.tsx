import { cx } from '../../lib/cx';

export interface TabItem<T extends string> {
  readonly id: T;
  readonly label: string;
}

interface TabsProps<T extends string> {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  containerClassName: string;
  buttonClassName: string;
  ariaLabel: string;
}

/**
 * Pill/tab strip shared by the catalogue view switch and the modal lot tabs.
 * Styling comes from the caller so both variants stay pixel-identical to the
 * original design.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  containerClassName,
  buttonClassName,
  ariaLabel,
}: TabsProps<T>) {
  return (
    <div className={containerClassName} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cx(buttonClassName, isActive && 'active')}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
