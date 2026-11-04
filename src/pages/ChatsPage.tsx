import { LoadingState } from '../components/LoadingState';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Send, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import './chats.css';
type Message={id:string;authorId:string;text:string;createdAt:string};
type Chat={id:string;entryId:string|null;entryKind:"auction"|"listing"|null;title:string;unread:number;members:{user:{id:string;displayName:string};readAt:string}[];messages:Message[]};
const time=(s:string)=>new Date(s).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
export function ChatsPage(){const {user}=useAuth();return <ChatWorkspace key={user?.id??'guest'} userId={user?.id}/>;}
function ChatWorkspace({userId}:{userId?:string|undefined}){
 const [params,setParams]=useSearchParams(),id=params.get('chat')??'';
 const [chats,setChats]=useState<Chat[]>([]),[messages,setMessages]=useState<Message[]>([]),[text,setText]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[more,setMore]=useState(false),[query,setQuery]=useState('');
 const currentId=useRef(id);currentId.current=id;const loaded=useRef(false);
 const end=useRef<HTMLDivElement>(null),pending=useRef<{text:string;clientId:string}|null>(null);
 const active=chats.find(c=>c.id===id),peer=active?.members.find(m=>m.user.id!==userId),[drafts,setDrafts]=useState<Record<string,string>>({});
 const refresh=useCallback(async(signal:AbortSignal)=>{
   const list=await apiRequest<Chat[]>('/api/v1/chats',{signal});if(signal.aborted)return;setChats(list);
   if(id){const result=await apiRequest<{items:Message[];hasMore:boolean}>('/api/v1/chats/'+id+'/messages',{signal});if(signal.aborted)return;
     setMessages(old=>[...new Map([...old,...result.items].map(m=>[m.id,m])).values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)));
     const last=result.items.at(-1);if(last&&document.visibilityState==='visible'){await apiRequest('/api/v1/chats/'+id+'/read',{method:'POST',body:{messageId:last.id},signal});if(!signal.aborted)setChats(list=>list.map(chat=>chat.id===id?{...chat,unread:0}:chat));}
     if(!loaded.current){setMore(result.hasMore);loaded.current=true;}
   }
 },[id]);
 useEffect(()=>{if(!userId)return;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;let alive=true;
   loaded.current=false;setMessages([]);setMore(false);setLoading(true);setError('');
   const tick=async()=>{try{await refresh(controller.signal);if(alive)setError('');}catch(e){if(alive&&!controller.signal.aborted)setError(e instanceof Error?e.message:'Не удалось загрузить чаты');}finally{if(alive){setLoading(false);timer=setTimeout(tick,4000);}}};void tick();
   return()=>{alive=false;controller.abort();clearTimeout(timer);};
 },[userId,refresh]);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[messages.at(-1)?.id]);
 useEffect(()=>{setText(drafts[id]??'');pending.current=null;},[id]);
 if(!userId)return <section className="chat-guest"><MessageCircle size={44}/><h2>Ваши разговоры — здесь</h2><p>Войдите, чтобы написать автору объявления и продолжить переписку.</p><Link className="btn-primary" to="/account">Войти в аккаунт</Link></section>;
 return <><header className="chat-intro"><div><h1>Чаты</h1><p>Обсудите состояние игры, доставку и детали сделки.</p></div><span>Личная переписка</span></header>
 <div className={'chat-workspace '+(id?'has-chat':'')}>
 <aside className="chat-list"><div className="chat-list-head"><strong>Сообщения</strong><span>{chats.reduce((n,c)=>n+c.unread,0)||''}</span></div><input aria-label="Поиск по чатам" placeholder="Найти собеседника или объявление" value={query} onChange={e=>setQuery(e.target.value)}/>
 {loading&&!chats.length&&<LoadingState variant="inline" className="chat-hint" message="Загружаем переписки…" />}
 {!loading&&!chats.length&&<p className="chat-hint">Пока нет переписок. Откройте объявление и нажмите «Написать автору».</p>}
 {chats.filter(c=>(c.title+' '+c.members.map(m=>m.user.displayName).join(' ')).toLowerCase().includes(query.toLowerCase())).map(c=>{const other=c.members.find(m=>m.user.id!==userId);return <button key={c.id} className={'chat-row '+(c.id===id?'selected':'')} onClick={()=>{setDrafts(d=>({...d,[id]:text}));setParams({chat:c.id});}}><span className="chat-avatar">{other?.user.displayName.slice(0,1)??'?'}</span><span className="chat-row-copy"><strong>{other?.user.displayName}</strong><small>{c.title}</small><span>{c.messages[0]?.text??'Начните разговор'}</span></span>{c.unread>0&&<b className="chat-unread">{c.unread}</b>}</button>;})}</aside>
 <section className="chat-conversation" aria-label="Переписка">{!id?<div className="chat-empty"><MessageCircle size={52}/><h2>Начните с разговора</h2><p>Выберите чат слева или напишите автору интересующего объявления.</p><Link className="btn-secondary" to="/listings">К объявлениям</Link></div>:<>
 <header className="chat-peer"><button className="btn-secondary" aria-label="К списку чатов" onClick={()=>setParams({})}><ArrowLeft size={18}/></button><span className="chat-avatar">{peer?.user.displayName.slice(0,1)??'?'}</span><div><Link to={'/users/'+peer?.user.id}>{peer?.user.displayName??'Переписка'}</Link><small>Личный диалог</small></div></header>
 {active?.entryId&&<Link className="chat-entry" to={(active.entryKind==='auction'?'/auctions':'/listings')+'?item='+encodeURIComponent(active.entryId)}><span>По объявлению</span><strong>{active.title}</strong><small>Открыть объявление ↗</small></Link>}
 <div className="chat-messages" role="log" aria-label="Сообщения">{more&&<button className="btn-secondary" onClick={async()=>{try{const r=await apiRequest<{items:Message[];hasMore:boolean}>('/api/v1/chats/'+id+'/messages?before='+messages[0]?.id);if(currentId.current===id){setMessages(old=>[...new Map([...r.items,...old].map(m=>[m.id,m])).values()]);setMore(r.hasMore);}}catch(e){setError(String(e));}}}>Предыдущие сообщения</button>}
 {loading&&!messages.length&&<LoadingState variant="inline" className="chat-hint" message="Загружаем сообщения…" />}
 {!loading&&!messages.length&&<div className="chat-empty"><MessageCircle size={32}/><h3>Договоритесь о деталях</h3><p>Уточните состояние, комплектацию или способ доставки.</p><button className="btn-secondary" onClick={()=>setText('Здравствуйте! Объявление ещё актуально?')}>Объявление ещё актуально?</button></div>}
 {messages.map(m=><div key={m.id} className={'chat-bubble '+(m.authorId===userId?'own':'')}><p>{m.text}</p><small>{new Date(m.createdAt).toLocaleDateString('ru-RU')} · {time(m.createdAt)} {m.authorId===userId&&peer&&peer.readAt>=m.createdAt&&<CheckCheck size={14} aria-label="Прочитано"/>}</small></div>)}<div ref={end}/></div>
 {error&&<p role="alert" className="chat-error">{error}</p>}
 <form className="chat-composer" onSubmit={async e=>{e.preventDefault();if(!text.trim()||sending)return;const current=id,body=pending.current?.text===text.trim()?pending.current:{text:text.trim(),clientId:crypto.randomUUID()};pending.current=body;setSending(true);setError('');try{const m=await apiRequest<Message>('/api/v1/chats/'+current+'/messages',{method:'POST',body});if(currentId.current===current){setMessages(old=>[...new Map([...old,m].map(v=>[v.id,v])).values()]);setText('');setDrafts(d=>({...d,[current]:''}));pending.current=null;}}catch(e){if(currentId.current===current)setError(e instanceof Error?e.message:'Сообщение не отправлено. Попробуйте ещё раз.');}finally{setSending(false);}}}>
 <textarea aria-label="Сообщение" placeholder="Напишите сообщение…" maxLength={4000} value={text} disabled={sending} onChange={e=>setText(e.target.value)} rows={2}/><button className="btn-primary" aria-label="Отправить сообщение" disabled={sending||!text.trim()}><Send size={20}/></button><small>Сообщения видны только вам и собеседнику · {text.length}/4000</small></form></>}
 </section></div>{error&&!id&&<p role="alert">{error}</p>}</>;
}
