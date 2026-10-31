import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
export function StartChatButton({entryId,userId}:{entryId?:string|undefined;userId?:string|undefined}) {
  const {user}=useAuth(),navigate=useNavigate();const [busy,setBusy]=useState(false),[error,setError]=useState('');
  return <div><button className="btn-primary" disabled={busy} onClick={async()=>{
    if(!user){navigate('/account');return;}setBusy(true);setError('');
    try{const c=await apiRequest<{id:string}>('/api/v1/chats',{method:'POST',body:entryId?{entryId}:{userId}});navigate('/chats?chat='+c.id);}catch(e){setError(e instanceof Error?e.message:'Не удалось открыть чат.');}finally{setBusy(false);}
  }}><MessageCircle size={17}/>{busy?'Открываем чат…':entryId?'Написать автору':'Написать сообщение'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
