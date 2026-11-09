import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection } from '../context/CollectionContext';
import { ModalShell } from '../components/ui/ModalShell';
import { GameCombobox } from '../components/ui/GameCombobox';
import { Combobox } from '../components/ui/Combobox';
import { CopyEditForm } from '../components/collection/CopyEditForm';
import { ApiState } from '../components/ApiState';
import { editionLabel } from '../lib/editions';
import { CollectionPage } from './CollectionPage';
import type { Copy } from '../types';

export function CollectionAddPage() {
  const navigate = useNavigate();
  const { games, editions, addCopy, isCatalogLoading, catalogError, syncError, refresh } = useCollection();
  const [gameId, setGameId] = useState('');
  const [editionId, setEditionId] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const game = games.find(item => item.id === gameId);
  const edition = editions.find(item => item.id === editionId && item.gameId === gameId);
  const options = editions.filter(item => item.gameId === gameId && editionLabel(item).toLowerCase().includes(query.toLowerCase())).map(item => ({value:item.id,label:editionLabel(item)}));
  const close = () => { if (!saving) navigate('/collection'); };
  const blank: Copy = {id:'new',editionId,condition:'',completeness:'',purchasePrice:null,purchaseDate:'',notes:'',photos:[],createdAt:''};
  return <><CollectionPage /><ModalShell isOpen onClose={close} labelledBy="add-copy-title" contentClassName="copy-detail-modal">
    <h2 id="add-copy-title">Пополнить коллекцию</h2>
    <ApiState loading={isCatalogLoading} error={catalogError} onRetry={refresh} />
    <fieldset disabled={saving} className="copy-detail__inline-fieldset">
      <label htmlFor="new-copy-game">Игра</label>
      <GameCombobox id="new-copy-game" games={games} value={gameId} onChange={id => {setGameId(id);setEditionId('');setQuery('');}} />
      <label htmlFor="new-copy-edition">Издание</label>
      <Combobox id="new-copy-edition" value={open ? query : edition ? editionLabel(edition) : ''} options={options} selectedValues={[editionId]} label="Издания" placeholder={game ? 'Найти издание…' : 'Сначала выберите игру'} open={open} onOpen={() => {setOpen(true);setQuery('');}} onClose={() => {setOpen(false);setQuery('');}} onQueryChange={text => {setQuery(text);setEditionId('');}} onSelect={item => {setEditionId(item.value);setOpen(false);setQuery('');}} emptyText={game ? 'Издания не найдены' : 'Сначала выберите игру'} />
    </fieldset>
    {game && edition && <CopyEditForm key={edition.id} copy={blank} game={game} edition={edition} quantity={1} titleId="new-copy-details" mode="create" showHeader={false} isSaving={saving} onCancel={close} onSubmit={async details => {setSaving(true);try {if(await addCopy(edition.id,details)) navigate(`/collection/${encodeURIComponent(edition.id)}`);}finally{setSaving(false);}}} />}
    {syncError && <p role="alert">{syncError}</p>}
  </ModalShell></>;
}