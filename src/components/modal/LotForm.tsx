import { useState } from 'react';
import type { FormEvent } from 'react';
import type { LotDraft, LotType } from '../../types';
import { FormField } from '../ui/FormField';

interface LotFormState {
  type: LotType;
  user: string;
  title: string;
  condition: string;
  price: string;
}

const INITIAL_FORM: LotFormState = {
  type: 'sale',
  user: '',
  title: '',
  condition: '',
  price: '',
};

interface LotFormProps {
  onCreateLot: (draft: LotDraft) => void;
}

/** Controlled "publish a listing" form; resets after every successful submit. */
export function LotForm({ onCreateLot }: LotFormProps) {
  const [form, setForm] = useState<LotFormState>(INITIAL_FORM);

  const update = (patch: Partial<LotFormState>) => {
    setForm((previous) => ({ ...previous, ...patch }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const user = form.user.trim();
    const title = form.title.trim();
    const condition = form.condition.trim();
    const price = Number.parseInt(form.price, 10);

    if (!user || !title || !condition || !Number.isFinite(price) || price <= 0) return;

    onCreateLot({ type: form.type, user, title, condition, price });
    setForm(INITIAL_FORM);
  };

  return (
    <div className="lot-form-section">
      <h4>Разместить лот по этой игре</h4>
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <FormField id="lotType" label="Тип предложения">
            <select
              id="lotType"
              className="form-control"
              value={form.type}
              onChange={(event) =>
                update({ type: event.target.value === 'purchase' ? 'purchase' : 'sale' })
              }
            >
              <option value="sale">Продажа (Я продаю)</option>
              <option value="purchase">Покупка (Я ищу)</option>
            </select>
          </FormField>

          <FormField id="lotUser" label="Ваше Имя / Ник">
            <input
              id="lotUser"
              type="text"
              required
              className="form-control"
              placeholder="Например, MaxRetro"
              value={form.user}
              onChange={(event) => update({ user: event.target.value })}
            />
          </FormField>

          <div className="form-group-full">
            <input
              id="lotTitle"
              type="text"
              required
              className="form-control"
              aria-label="Заголовок лота"
              placeholder="Заголовок лота (например, Комплект CIB, идеальное состояние)"
              value={form.title}
              onChange={(event) => update({ title: event.target.value })}
            />
          </div>

          <FormField id="lotCondition" label="Состояние / Комплект">
            <input
              id="lotCondition"
              type="text"
              required
              className="form-control"
              placeholder="9/10, с мануалом"
              value={form.condition}
              onChange={(event) => update({ condition: event.target.value })}
            />
          </FormField>

          <FormField id="lotPrice" label="Цена (₽)">
            <input
              id="lotPrice"
              type="number"
              required
              min={1}
              step={1}
              inputMode="numeric"
              className="form-control"
              placeholder="Цена в рублях"
              value={form.price}
              onChange={(event) => update({ price: event.target.value })}
            />
          </FormField>
        </div>

        <button type="submit" className="btn-submit">
          Разместить объявление
        </button>
      </form>
    </div>
  );
}
