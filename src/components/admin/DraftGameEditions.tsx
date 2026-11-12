import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { adminOptionLabel, type AdminRecord, type AdminTable } from '@discvault/shared';
import { AdminDataTable } from './AdminDataTable';
import { AdminRecordDialog } from './AdminRecordDialog';
import { IconButton } from '../ui/IconButton';

/** Unsaved editions use the same table and editor as persisted records. */
export function DraftGameEditions({table, rows, onChange}: {table: AdminTable; rows: AdminRecord[]; onChange: (rows: AdminRecord[]) => void}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [sort, setSort] = useState('name');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const fields = table.fields.filter(field => !field.readOnly && !field.primary && field.name !== 'gameId');
  const items = rows.map((row, index) => ({...row, __draftIndex: index})).sort((a,b) => String((a as AdminRecord)[sort] ?? '').localeCompare(String((b as AdminRecord)[sort] ?? ''), 'ru', {numeric:true}) * (direction === 'asc' ? 1 : -1));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 20)));
  return <>
    <div className="admin-data__toolbar"><button type="button" className="btn-primary" onClick={() => setEditing(-1)}><Plus size={16} strokeWidth={2.5} />Добавить издание</button></div>
    <AdminDataTable<AdminRecord> label="Черновики изданий игры" storageKey="Edition:game" columns={fields.map(field => ({key:field.name,label:field.label,sortable:field.type !== 'list',render:row => <span className="admin-data__cell">{field.type === 'enum' ? adminOptionLabel(String(row[field.name] ?? '—')) : Array.isArray(row[field.name]) ? (row[field.name] as string[]).join(', ') : String(row[field.name] ?? '—')}</span>}))}
      rows={items.slice((currentPage-1)*20,currentPage*20)} rowKey={row=>String(row.__draftIndex)} sortBy={sort} sortDir={direction} onSort={key=>{setSort(key);setDirection(key===sort && direction==='asc'?'desc':'asc');}} loading={false} total={rows.length} page={currentPage} pageSize={20} onPage={setPage} onReset={()=>{}} hasFilters={false}
      actions={row=><><IconButton label="Редактировать издание" title="Редактировать издание" onClick={()=>setEditing(Number(row.__draftIndex))}><Pencil size={20}/></IconButton><IconButton label="Удалить издание" title="Удалить издание" onClick={()=>onChange(rows.filter((_,index)=>index!==Number(row.__draftIndex)))}><Trash2 size={20}/></IconButton></>} />
    {editing !== null && <AdminRecordDialog key={editing} table={table} editor={{mode:'create',key:null}} title={editing<0?'Добавить издание':'Редактировать издание'} fixedValues={{gameId:'draft'}} {...(editing>=0?{initialRecord:rows[editing]!}:{})} onClose={()=>setEditing(null)} onSaved={()=>{}} onSubmitRecord={record=>{const {gameId: _gameId,...data}=record;onChange(editing<0?[...rows,data]:rows.map((row,index)=>index===editing?data:row));}} />}
  </>;
}
