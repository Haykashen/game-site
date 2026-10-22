import { Package, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { COMPLETENESS } from '../../data';
import { editionLabel } from '../../lib/editions';
import type { Copy, CopyDetails, Edition, Game } from '../../types';
import { FormField } from '../ui/FormField';
import { IconButton } from '../ui/IconButton';
import { PhotoPicker } from '../market/PhotoPicker';

interface CopyEditFormProps {
  copy: Copy;
  edition: Edition;
  game: Game;
  quantity: number;
  titleId: string;
  onSubmit: (details: CopyDetails) => void;
  onCancel: () => void;
}

/**
 * Editor for the physical details of one edition on the shelf. Every copy in
 * the quantity group shares these fields, so the notice explains that bulk edit.
 */
export function CopyEditForm({
  copy,
  edition,
  game,
  quantity,
  titleId,
  onSubmit,
  onCancel,
}: CopyEditFormProps) {
  const [condition, setCondition] = useState(copy.condition);
  const [completeness, setCompleteness] = useState(copy.completeness);
  const [notes, setNotes] = useState(copy.notes);
  const [photos, setPhotos] = useState<string[]>([...copy.photos]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isProcessingPhotos) return;

    onSubmit({
      condition: condition.trim() || 'Не указано',
      completeness: completeness.trim() || 'Не указано',
      notes: notes.trim(),
      photos,
    });
  };

  return (
    <>
      <div className="modal-header">
        <div>
          <div className="modal-header-meta">
            <span className="market-kind">
              <Package size={13} aria-hidden="true" />
              Экземпляр
            </span>
            <span className="meta-chip">Коллекция</span>
          </div>
          <h2 className="modal-title" id={titleId}>
            Редактировать экземпляр
          </h2>
        </div>
        <IconButton label="Закрыть" transparent onClick={onCancel}>
          <X size={20} />
        </IconButton>
      </div>

      <p className="market-form__lead">
        {game.title} • {editionLabel(edition)}
      </p>

      {quantity > 1 && (
        <p className="copy-form__notice">
          Изменения применятся ко всем {quantity} экземплярам этого издания.
        </p>
      )}

      <form className="market-form" onSubmit={handleSubmit}>
        <div className="market-form__grid">
          <FormField id="copyCondition" label="Состояние">
            <input
              id="copyCondition"
              type="text"
              className="form-control"
              maxLength={60}
              placeholder="Например, 9/10"
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
            />
          </FormField>

          <FormField id="copyCompleteness" label="Комплектность">
            <input
              id="copyCompleteness"
              type="text"
              className="form-control"
              list="copyCompletenessOptions"
              maxLength={60}
              placeholder="Например, CIB"
              value={completeness}
              onChange={(event) => setCompleteness(event.target.value)}
            />
            <datalist id="copyCompletenessOptions">
              {COMPLETENESS.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </FormField>

          <FormField id="copyNotes" label="Заметки" className="market-form__full">
            <textarea
              id="copyNotes"
              className="form-control"
              rows={5}
              maxLength={600}
              placeholder="Состояние диска, вложения, история покупки…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>

          <div className="market-form__full">
            <PhotoPicker
              photos={photos}
              onChange={setPhotos}
              onBusyChange={setIsProcessingPhotos}
            />
          </div>
        </div>

        <div className="market-form__actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Отмена
          </button>
          <button
            type="submit"
            className="market-form__submit copy-form__submit"
            disabled={isProcessingPhotos}
          >
            {isProcessingPhotos ? 'Обработка фото…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </>
  );
}
