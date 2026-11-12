import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { adminOptionLabel, type AdminRecord, type AdminTable, type AdminValue } from '@discvault/shared';
import { AdminDataTable } from './AdminDataTable';
import { ReferenceCombobox } from './ReferenceCombobox';
import { IconButton } from '../ui/IconButton';
import { createAdminRecord, fetchAdminRecords, updateAdminRecord } from '../../api/adminData';
import { errorMessage } from '../../api/client';

export function DraftGameEditions({table, rows, onChange, gameId}: {table: AdminTable; rows: AdminRecord[]; onChange: (rows: AdminRecord[]) => void; gameId?: string}) {
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fields = table.fields.filter(field => !field.readOnly && !field.primary && field.name !== 'gameId');
  useEffect(() => {
    if (!gameId) return;
    const controller = new AbortController();
    setBusy(true);
    void (async () => {
      const result: AdminRecord[] = [];
      let next = 1;
      while (!controller.signal.aborted) {
        const response = await fetchAdminRecords('Edition', {filters:{gameId},page:next,pageSize:100}, controller.signal);
        result.push(...response.items);
        if (!response.hasMore) break;
        next++;
      }
      if (!controller.signal.aborted) onChange(result);
    })().catch(cause => {if (!controller.signal.aborted) setError(errorMessage(cause));}).finally(()=>{if (!controller.signal.aborted) setBusy(false);});
    return ()=>controller.abort();
  }, [gameId]);
  function change(index: number, field: string, value: AdminValue) {onChange(rows.map((row,i)=>i===index?{...row,[field]:value}:row));}
  async function save(index: number) {
    const row = rows[index]!;
    const data: AdminRecord = {gameId: gameId!};
    for (const field of fields) if (row[field.name] !== undefined && !(field.generated && row[field.name] === '')) data[field.name] = row[field.name]!;
    setBusy(true);setError('');
    try {
      const saved = row.id ? await updateAdminRecord('Edition',JSON.stringify({id:row.id}),data,String(row.updatedAt)) : await createAdminRecord('Edition',data);
      onChange(rows.map((item,i)=>i===index?saved.record:item));
    } catch(cause) {setError(errorMessage(cause));} finally {setBusy(false);}
  }
  const currentPage = Math.min(page,Math.max(1,Math.ceil(rows.length/20)));
  return <>
    <div className="game-editions-heading"><h3>Издания игры</h3><button type="button" className="btn-secondary" disabled={busy} onClick={()=>{onChange([...rows,{}]);setPage(Math.ceil((rows.length+1)/20));}}><Plus size={16} strokeWidth={2.5}/>Добавить издание</button></div>
    {error && <p role="alert" className="admin-data__error">{error}</p>}
    <AdminDataTable<AdminRecord> label="Издания игры" storageKey="Edition:game" columns={fields.map(field=>({key:field.name,label:field.label,sortable:false,render:row=>{
      const index=Number(row.__draftIndex), id='edition-'+index+'-'+field.name;
      const value=row[field.name];
      const text=Array.isArray(value)?value.join('\n'):String(value??'');
      return <div className="game-editions-cell">{field.reference ? <ReferenceCombobox reference={field.reference} entity="Edition" inputId={id} required={field.required} value={text} onChange={next=>change(index,field.name,next)}/>
        : field.type==='enum' || field.type==='boolean' ? <select className="form-control" aria-label={field.label} disabled={busy} value={text} onChange={event=>change(index,field.name,field.type==='boolean'?event.target.value==='true':event.target.value)}><option value="">По умолчанию</option>{(field.type==='boolean'?['true','false']:field.options).map(option=><option key={option} value={option}>{adminOptionLabel(option)}</option>)}</select>
        : field.multiline || field.type==='list' ? <textarea className="form-control" aria-label={field.label} rows={2} disabled={busy} value={text} onChange={event=>change(index,field.name,field.type==='list'?event.target.value.split('\n').filter(Boolean):event.target.value)}/>
        : <input className="form-control" aria-label={field.label} disabled={busy} value={text} type={field.type==='number'?'number':'text'} onChange={event=>change(index,field.name,field.type==='number' && event.target.value!==''?Number(event.target.value):event.target.value)}/>}</div>;
    }}))} rows={rows.map((row,index)=>({...Object.fromEntries(Object.entries(row).filter(([key])=>!key.startsWith('__reference_'))),__draftIndex:index})).slice((currentPage-1)*20,currentPage*20)} rowKey={row=>String(row.__draftIndex)} sortBy="" sortDir="asc" onSort={()=>{}} loading={busy} total={rows.length} page={currentPage} pageSize={20} onPage={setPage} onReset={()=>{}} hasFilters={false}
      actions={row=><>{gameId && <IconButton label="Сохранить издание" title="Сохранить издание" disabled={busy} onClick={()=>void save(Number(row.__draftIndex))}><Save size={20}/></IconButton>}{!row.id && <IconButton label="Удалить строку" title="Удалить строку" disabled={busy} onClick={()=>onChange(rows.filter((_,index)=>index!==Number(row.__draftIndex)))}><Trash2 size={20}/></IconButton>}</>} />
  </>;
}
