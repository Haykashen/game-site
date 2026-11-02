import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { API_MUTATION_EVENT, ApiError, apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function useModerationCount() {
  const {user,isModerator,status} = useAuth();
  const {pathname} = useLocation();
  const identity = `${user?.id}:${user?.role}`;
  const enabled = isModerator && status === 'api';
  const [result,setResult] = useState({identity:'',count:0});
  useEffect(()=>{
    if (!enabled) return;
    const controller = new AbortController();
    let busy=false, again=false;
    const refresh = async () => {
      if (controller.signal.aborted || document.visibilityState === 'hidden') return;
      if (busy) {again=true;return;}
      busy=true;
      try {
        const data = await apiRequest<{count:number}>('/api/v1/admin/market/pending-count',{signal:controller.signal});
        if (!controller.signal.aborted) setResult({identity,count:Math.max(0,data.count)});
      } catch (cause) {
        if (!controller.signal.aborted && cause instanceof ApiError && [401,403].includes(cause.status)) setResult({identity,count:0});
      } finally {
        busy=false;
        if (again && !controller.signal.aborted) {again=false;void refresh();}
      }
    };
    void refresh();
    const interval=window.setInterval(()=>void refresh(),30000);
    const update=()=>{void refresh();};
    window.addEventListener('focus',update);
    window.addEventListener('online',update);
    window.addEventListener(API_MUTATION_EVENT,update);
    document.addEventListener('visibilitychange',update);
    return ()=>{controller.abort();window.clearInterval(interval);window.removeEventListener('focus',update);window.removeEventListener('online',update);window.removeEventListener(API_MUTATION_EVENT,update);document.removeEventListener('visibilitychange',update);};
  },[identity,enabled,pathname]);
  return enabled && result.identity===identity ? result.count : 0;
}
