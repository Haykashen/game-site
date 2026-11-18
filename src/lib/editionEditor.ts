import type { AdminField, AdminRecord } from '@discvault/shared';
export function editionWriteData(row:AdminRecord, fields:readonly AdminField[], rowNumber:number):AdminRecord|null {
 const editable=fields.filter(field=>!field.readOnly && !field.primary && field.name!=='gameId');
 const meaningful=editable.some(field=>{const value=row[field.name];return Array.isArray(value)?value.length>0:value!==undefined && value!==null && value!=='';});
 if(!row.id && !meaningful)return null;
 const missing=editable.filter(field=>field.required && (row[field.name]===undefined || row[field.name]===null || typeof row[field.name]==='string' && !String(row[field.name]).trim()));
 if(missing.length)throw new Error(`Издание, строка ${rowNumber}: заполните ${missing.map(field=>'«'+field.label+'»').join(', ')}.`);
 return Object.fromEntries(editable.filter(field=>row[field.name]!==undefined && !(field.generated && row[field.name]==='')).map(field=>[field.name,row[field.name]!]));
}
