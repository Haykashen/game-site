import { CollectionCopyDetail } from './CollectionCopyPage';
import { CollectionPage } from './CollectionPage';
import type { Copy, Edition, Game } from '../types';
import { useSearchParams } from 'react-router-dom';
import { useCollection } from '../context/CollectionContext';
import { ApiState } from '../components/ApiState';
const copy: Copy = {id:'new',editionId:'',condition:'',completeness:'',purchasePrice:null,purchaseDate:'',notes:'',photos:[],createdAt:''};
const edition = {id:'',gameId:'',name:'',platform:'',region:'',contents:[],coverImages:[]} as unknown as Edition;
const game = {id:'',title:''} as Game;
export function CollectionAddPage() {
  const [search] = useSearchParams();
  const {editionById, games, isCatalogLoading, catalogError, refresh} = useCollection();
  const requestedEdition = search.get('editionId');
  const selectedEdition = editionById.get(requestedEdition ?? '');
  const selectedGame = games.find(item => item.id === selectedEdition?.gameId);
  return <><CollectionPage />{requestedEdition && (!selectedEdition || !selectedGame)
    ? <ApiState loading={isCatalogLoading} error={catalogError ?? (!isCatalogLoading ? 'Издание не найдено.' : null)} onRetry={refresh} />
    : <CollectionCopyDetail key={selectedEdition?.id ?? 'new'} copy={copy} group={[]} edition={selectedEdition ?? edition} game={selectedGame ?? game} initiallyEditing creating />}</>;
}
