import { CollectionCopyDetail } from './CollectionCopyPage';
import { CollectionPage } from './CollectionPage';
import type { Copy, Edition, Game } from '../types';
const copy: Copy = {id:'new',editionId:'',condition:'',completeness:'',purchasePrice:null,purchaseDate:'',notes:'',photos:[],createdAt:''};
const edition = {id:'',gameId:'',name:'',platform:'',region:'',contents:[],coverImages:[]} as unknown as Edition;
const game = {id:'',title:''} as Game;
export function CollectionAddPage() { return <><CollectionPage /><CollectionCopyDetail copy={copy} group={[]} edition={edition} game={game} initiallyEditing creating /></>; }
