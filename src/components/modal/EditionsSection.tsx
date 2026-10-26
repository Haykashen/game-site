import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Check, Image as ImageIcon, Layers, Package, Plus } from 'lucide-react';
import { getPlatformBadgeStyle } from '../../data/reference';
import { cx } from '../../lib/cx';
import { MAX_COLLECTION_QUANTITY } from '../../lib/constants';
import { editionContentsLabel, formatEditionDate } from '../../lib/editions';
import { editionsCountLabel } from '../../lib/market';
import type { Copy, Edition, Game } from '../../types';

interface EditionsSectionProps {
  game: Game;
  editions: readonly Edition[];
  copies: readonly Copy[];
  selectedEditionId: string;
  onSelectEdition: (editionId: string) => void;
  onAddCopy: (editionId: string) => Promise<boolean>;
}

interface EditionCardProps {
  edition: Edition;
  ownedCount: number;
  isSelected: boolean;
  onSelect: () => void;
  onAddCopy: () => Promise<boolean>;
}

function EditionCard({
  edition,
  ownedCount,
  isSelected,
  onSelect,
  onAddCopy,
}: EditionCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const cover = edition.coverImages[0];
  const [justAdded, setJustAdded] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  const handleAddCopy = async () => {
    if (!user) { navigate('/account'); return; }
    if (isAdding) return;
    if (ownedCount >= MAX_COLLECTION_QUANTITY) return;

    onSelect();
    setIsAdding(true);
    const saved = await onAddCopy();
    setIsAdding(false);
    if (!saved) return;
    setJustAdded(true);

    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
    }

    resetTimer.current = window.setTimeout(() => {
      setJustAdded(false);
      resetTimer.current = null;
    }, 1400);
  };

  return (
    <article
      className={cx('edition-card', isSelected && 'is-selected')}
      data-edition-id={edition.id}
      data-dns-product={edition.dnsProductId || undefined}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Выбрать издание ${edition.name} для ${edition.platform}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="edition-card__cover">
        {cover ? (
          <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="edition-card__placeholder">
            <ImageIcon size={28} aria-hidden="true" />
            <span>{edition.name}</span>
          </div>
        )}

        <span
          className="badge-platform badge-platform--static edition-card__platform"
          data-platform={edition.platform}
          style={getPlatformBadgeStyle(edition.platform)}
        >
          {edition.platform}
        </span>

        {ownedCount > 0 && (
          <span className="edition-card__owned" key={ownedCount}>
            <Check size={12} aria-hidden="true" /> ×{ownedCount}
          </span>
        )}
      </div>

      <div className="edition-card__body">
        <div>
          <h5 className="edition-card__title">{edition.name}</h5>
          <p className="edition-card__subtitle">
            {edition.region} • {edition.lang}
          </p>
        </div>

        <div className="edition-card__meta">
          <span className="edition-chip">{formatEditionDate(edition.releaseDate)}</span>
          <span className="edition-chip">{edition.media}</span>
        </div>

        {edition.description && (
          <p className="edition-card__description">{edition.description}</p>
        )}
        {!!edition.variants?.length && <details className="edition-variants" onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
          <summary>Варианты поставки: {edition.variants.length + 1}</summary>
          {[edition,...edition.variants].map(variant=><p key={variant.id}>
            {variant.dnsProductCode ? `Артикул ${variant.dnsProductCode}. ` : ''}{variant.description || variant.lang}
          </p>)}
        </details>}

        <p className="edition-card__contents">
          <Package size={13} aria-hidden="true" />
          <span>{editionContentsLabel(edition, 3)}</span>
        </p>

        <div className="edition-card__actions">
          <button
            type="button"
            className="edition-card__btn edition-card__btn--ghost"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
          >
            <Layers size={14} aria-hidden="true" />
            Объявления
          </button>
          <button
            type="button"
            className={cx(
              'edition-card__btn',
              'edition-card__btn--primary',
              justAdded && 'is-added',
            )}
            disabled={isAdding || ownedCount >= MAX_COLLECTION_QUANTITY}
            onClick={(event) => {
              event.stopPropagation();
              handleAddCopy();
            }}
          >
            {justAdded ? (
              <Check
                className="edition-card__btn-icon edition-card__btn-icon--check"
                size={14}
                aria-hidden="true"
              />
            ) : (
              <Plus className="edition-card__btn-icon" size={14} aria-hidden="true" />
            )}
            <span className="edition-card__btn-label">
              {justAdded ? 'Добавлено' : 'В коллекцию'}
            </span>
          </button>
        </div>

        <span className="sr-only" role="status" aria-live="polite">
          {justAdded ? `Издание ${edition.name} добавлено в коллекцию` : ''}
        </span>
      </div>
    </article>
  );
}

/** All releases of the abstract game, each with its own cover and contents. */
export function EditionsSection({
  game,
  editions,
  copies,
  selectedEditionId,
  onSelectEdition,
  onAddCopy,
}: EditionsSectionProps) {
  const groups = new Map<string, Edition[]>();

  for (const edition of editions) {
    const list = groups.get(edition.platform);

    if (list) {
      list.push(edition);
    } else {
      groups.set(edition.platform, [edition]);
    }
  }

  return (
    <section className="editions-section" aria-label="Издания игры">
      <div className="editions-section__head">
        <div>
          <h4>Издания</h4>
          <p className="editions-section__hint">
            Платформа, регион, язык и комплектация каждой версии — выберите нужную.
          </p>
        </div>
        <span className="editions-section__count">{editionsCountLabel(editions.length)}</span>
      </div>

      {editions.length === 0 ? (
        <div className="editions-section__empty">
          <p>Для этой игры пока не описано ни одного издания.</p>
        </div>
      ) : (
        <div className="editions-groups">
          {[...groups.entries()].map(([platform, platformEditions]) => (
            <section className="editions-group" key={platform} aria-label={platform}>
              <div className="editions-group__head">
                <span
                  className="badge-platform badge-platform--static"
                  data-platform={platform}
                  style={getPlatformBadgeStyle(platform)}
                >
                  {platform}
                </span>
                <span className="editions-group__count">
                  {editionsCountLabel(platformEditions.length)}
                </span>
              </div>
              <div className="editions-grid">
                {platformEditions.map((edition) => (
                  <EditionCard
                    key={edition.id}
                    edition={edition}
                    ownedCount={copies.filter((copy) => copy.editionId === edition.id).length}
                    isSelected={edition.id === selectedEditionId}
                    onSelect={() => onSelectEdition(edition.id)}
                    onAddCopy={() => onAddCopy(edition.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="editions-section__game">
        {game.title}: {editionsCountLabel(editions.length)} в каталоге.
      </p>
    </section>
  );
}
