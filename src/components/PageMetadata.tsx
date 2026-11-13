import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiRequest } from '../api/client';

/** Keep client navigation consistent with metadata in the initial server HTML. */
export function PageMetadata() {
  const {pathname, search} = useLocation();
  const query=new URLSearchParams(search);
  const metadataQuery=new URLSearchParams();
  for(const key of ['game','item','post'])if(query.has(key))metadataQuery.set(key,query.get(key)!);
  const metadataPath=pathname+(metadataQuery.size?'?'+metadataQuery.toString():'');
  useEffect(() => {
    const controller=new AbortController();
    void apiRequest<{title:string;description:string;url:string;image:string;type:string;robots:string;jsonLd:unknown}>('/api/v1/seo?path='+encodeURIComponent(metadataPath),{signal:controller.signal}).then(meta=>{
      if(controller.signal.aborted)return;
      document.title=meta.title;
      const values:Record<string,string>={'description':meta.description,'robots':meta.robots,'og:title':meta.title,'og:description':meta.description,'og:url':meta.url,'og:image':meta.image,'og:type':meta.type,'twitter:title':meta.title,'twitter:description':meta.description,'twitter:image':meta.image};
      for(const [key,value] of Object.entries(values)) {
        const attribute=key.startsWith('og:')?'property':'name';
        let element=document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
        if(!element){element=document.createElement('meta');element.setAttribute(attribute,key);document.head.append(element);}
        element.content=value;
      }
      let canonical=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}canonical.href=meta.url;
      let json=document.getElementById('discvault-jsonld');
      if(!json){json=document.createElement('script');json.id='discvault-jsonld';json.setAttribute('type','application/ld+json');document.head.append(json);}json.textContent=JSON.stringify(meta.jsonLd);
    }).catch(()=>{/* Metadata failure must not block application navigation. */});
    return ()=>controller.abort();
  },[metadataPath]);
  return null;
}
