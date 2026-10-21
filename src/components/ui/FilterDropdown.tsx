import { Check, ChevronDown } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { cx } from '../../lib/cx';

export interface FilterOption {
  readonly value: string;
  readonly label: string;
  readonly group?: string;
}

interface FilterDropdownProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  options: ReadonlyArray<FilterOption>;
  onChange: (value: string) => void;
}

/**
 * Accessible custom select for catalogue filters. Native selects cannot show
 * grouped options, checkmarks or the active state used by the redesign.
 */
export function FilterDropdown({
  id,
  label,
  placeholder,
  value,
  options,
  onChange,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const allOptions = useMemo<ReadonlyArray<FilterOption>>(
    () => [{ value: '', label: placeholder }, ...options],
    [options, placeholder],
  );

  const optionIndex = useMemo(
    () => new Map(allOptions.map((option, index) => [option.value, index])),
    [allOptions],
  );

  const selectedOption = allOptions.find((option) => option.value === value) ?? allOptions[0];

  const close = useCallback((returnFocus: boolean) => {
    setIsOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const selectedIndex = allOptions.findIndex((option) => option.value === value);
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    optionRefs.current[nextIndex]?.focus();
  }, [allOptions, isOpen, value]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  useEscapeKey(() => {
    if (isOpen) close(true);
  }, isOpen);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;

    if (!isOpen) return;
    if (nextTarget instanceof Node && rootRef.current?.contains(nextTarget)) return;

    setIsOpen(false);
  };

  const focusOption = (index: number) => {
    const nextIndex = (index + allOptions.length) % allOptions.length;
    optionRefs.current[nextIndex]?.focus();
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = optionRefs.current.findIndex((node) => node === document.activeElement);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusOption(currentIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusOption(currentIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusOption(0);
        break;
      case 'End':
        event.preventDefault();
        focusOption(allOptions.length - 1);
        break;
      default:
        break;
    }
  };

  const renderOption = (option: FilterOption) => {
    const isSelected = option.value === value;

    return (
      <button
        key={option.value || '__all__'}
        ref={(node) => {
          optionRefs.current[optionIndex.get(option.value) ?? 0] = node;
        }}
        type="button"
        role="option"
        aria-selected={isSelected}
        aria-label={option.group ? `${option.group}, ${option.label}` : option.label}
        tabIndex={-1}
        className={cx('filter-option', isSelected && 'is-selected')}
        onClick={() => {
          onChange(option.value);
          close(true);
        }}
      >
        <span>{option.label}</span>
        {isSelected && <Check size={15} className="filter-option__check" aria-hidden="true" />}
      </button>
    );
  };

  const emptyOption = allOptions[0];

  return (
    <div className="filter-field" ref={rootRef} onBlur={handleBlur}>
      <span className="filter-field__label" id={`${id}-label`}>
        {label}
      </span>

      <div className="filter-dropdown">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className={cx(
            'filter-trigger',
            value !== '' && 'has-value',
            isOpen && 'is-open',
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? `${id}-listbox` : undefined}
          aria-labelledby={`${id}-label ${id}-value`}
          onClick={() => (isOpen ? close(true) : setIsOpen(true))}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setIsOpen(true);
            }
          }}
        >
          <span className="filter-trigger__value" id={`${id}-value`}>
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronDown size={16} className="filter-trigger__icon" aria-hidden="true" />
        </button>

        {isOpen && (
          <div
            className="filter-popover"
            id={`${id}-listbox`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            onKeyDown={handleListKeyDown}
          >
            {emptyOption && renderOption(emptyOption)}

            {options.map((option, index) => {
              const showGroupLabel = Boolean(
                option.group && option.group !== options[index - 1]?.group,
              );

              return (
                <Fragment key={option.value}>
                  {showGroupLabel && (
                    <div className="filter-option-group__label" aria-hidden="true">
                      {option.group}
                    </div>
                  )}
                  {renderOption(option)}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
