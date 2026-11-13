import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';
import { statusWhere, marketStatusWhere } from './lib/statusSource.js';

export interface PageMetadata {title:string; description:string; url:string; image:string; type:string; robots:string; jsonLd:Record<string,unknown>; status:number}
const SITE_DESCRIPTION = 'Игры, коллекции, объявления и аукционы физических изданий видеоигр на DiscVault.';
export const escapeHtml = (value:string) => value.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function publicImage(value:string|undefined, siteUrl:string):string {
  if (!value || value.startsWith('data:')) return siteUrl + '/og-default.png';
  try {const url=new URL(value,siteUrl);if(url.pathname.startsWith('/uploads/'))return new URL(url.pathname,siteUrl).href;return ['http:','https:'].includes(url.protocol)?url.href:siteUrl+'/og-default.png';}catch{return siteUrl+'/og-default.png';}
}
export function renderMetadata(html:string, meta:PageMetadata):string {
  const head = `<title>${escapeHtml(meta.title)}</title>
<meta name="description" content="${escapeHtml(meta.description)}">
<link rel="canonical" href="${escapeHtml(meta.url)}">
<meta name="robots" content="${meta.robots}">
<meta property="og:site_name" content="DiscVault">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${escapeHtml(meta.title)}">
<meta property="og:description" content="${escapeHtml(meta.description)}">
<meta property="og:type" content="${meta.type}">
<meta property="og:url" content="${escapeHtml(meta.url)}">
<meta property="og:image" content="${escapeHtml(meta.image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(meta.title)}">
<meta name="twitter:description" content="${escapeHtml(meta.description)}">
<meta name="twitter:image" content="${escapeHtml(meta.image)}">
<script id="discvault-jsonld" type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g,'\\u003c')}</script>`;
  return html.replace(/<title>[\s\S]*?<\/title>/i,'').replace('</head>',head+'\n</head>');
}
export async function pageMetadata(app:FastifyInstance, raw:string, siteUrl:string):Promise<PageMetadata> {
  const input=new URL(raw,siteUrl);const pathname=input.pathname.replace(/\/$/,'') || '/';
  const titles:Record<string,string>={'/':'DiscVault','/games':'Игры','/auctions':'Аукционы','/listings':'Объявления','/listings/sales':'Продажи','/listings/purchases':'Покупки','/listings/exchange':'Обмен','/community/showcase':'Витрина коллекций','/news':'Новости','/discussions':'Обсуждения'};
  const publicPage=Object.hasOwn(titles,pathname);
  const meta:PageMetadata={title:(titles[pathname]??'DiscVault')+(pathname==='/'?'':' — DiscVault'),description:SITE_DESCRIPTION,url:siteUrl+pathname,image:siteUrl+'/og-default.png',type:'website',robots:publicPage?'index,follow':'noindex,nofollow',jsonLd:{'@context':'https://schema.org','@type':'WebSite',name:'DiscVault',url:siteUrl+'/'},status:200};
  if (!publicPage) return meta;
  const missing=()=>{meta.title='Страница не найдена — DiscVault';meta.description='Публикация недоступна.';meta.robots='noindex,nofollow';meta.status=404;};
  if(pathname==='/games' && input.searchParams.has('game')) {
    const id=input.searchParams.get('game')!;
    const game=await app.prisma.game.findFirst({where:{id,...statusWhere({notIn:['hidden','removed']})},include:{genres:true,editions:{select:{platform:true,coverImages:true}}}});
    if(!game){missing();return meta;}
    meta.title=game.title+' — DiscVault';meta.description=game.description.slice(0,300)||SITE_DESCRIPTION;meta.url+='?game='+encodeURIComponent(id);meta.image=publicImage(game.coverImage||game.editions.flatMap(e=>e.coverImages)[0],siteUrl);
    meta.jsonLd={'@context':'https://schema.org','@type':'VideoGame',name:game.title,url:meta.url,image:meta.image,description:meta.description,gamePlatform:[...new Set(game.editions.map(e=>e.platform))],genre:game.genres.map(g=>g.name),...(game.developer?{author:{'@type':'Organization',name:game.developer}}:{}),...(game.publisher?{publisher:{'@type':'Organization',name:game.publisher}}:{})};
  } else if(pathname==='/community/showcase' && input.searchParams.has('post')) {
    const id=input.searchParams.get('post')!;
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){missing();return meta;}
    const post=await app.prisma.copyShare.findFirst({where:{id,copy:{user:statusWhere('active')}},select:{topic:true,caption:true,photos:true,createdAt:true,copy:{select:{user:{select:{displayName:true}},edition:{select:{game:{select:{title:true}}}}}}}});
    if(!post){missing();return meta;}
    meta.title=(post.topic||post.copy.edition.game.title)+' — DiscVault';meta.description=post.caption.slice(0,300)||'Публикация коллекционера '+post.copy.user.displayName;meta.url+='?post='+encodeURIComponent(id);meta.image=publicImage(post.photos[0],siteUrl);meta.type='article';
    meta.jsonLd={'@context':'https://schema.org','@type':'SocialMediaPosting',headline:meta.title,articleBody:post.caption,url:meta.url,image:meta.image,datePublished:post.createdAt.toISOString(),author:{'@type':'Person',name:post.copy.user.displayName}};
  } else if((pathname==='/auctions'||pathname.startsWith('/listings')) && input.searchParams.has('item')) {
    const id=input.searchParams.get('item')!;
    const entry=await app.prisma.marketEntry.findFirst({where:{id,deletedAt:null,...marketStatusWhere({moderationStatus:'visible'}),author:statusWhere('active')},select:{title:true,description:true,kind:true,listingType:true,priceMinor:true,photos:{select:{url:true},orderBy:{sortOrder:'asc'}}}});
    if(!entry){missing();return meta;}
    meta.title=entry.title+' — DiscVault';meta.description=entry.description.slice(0,300)||SITE_DESCRIPTION;meta.url=siteUrl+(entry.kind==='auction'?'/auctions':'/listings/'+(entry.listingType==='purchase'?'purchases':entry.listingType==='exchange'?'exchange':'sales'))+'?item='+encodeURIComponent(id);meta.image=publicImage(entry.photos[0]?.url,siteUrl);
    meta.jsonLd={'@context':'https://schema.org','@type':'WebPage',name:entry.title,url:meta.url,description:meta.description,image:meta.image,mainEntity:{'@type':'Product',name:entry.title,description:meta.description,image:meta.image,...(entry.kind==='listing' && entry.listingType==='sale' && entry.priceMinor!==null?{offers:{'@type':'Offer',price:(entry.priceMinor/100).toFixed(2),priceCurrency:'RUB',url:meta.url}}:{})}};
  }
  return meta;
}
export function registerSeoRoutes(app:FastifyInstance, htmlTemplate?:string) {
  app.get('/api/v1/seo',async(request,reply)=>{
    const raw=(request.query as {path?:string}).path??'/';
    if(typeof raw!=='string'||!raw.startsWith('/')||raw.startsWith('//')||raw.length>3000)return reply.code(400).send({error:'Некорректный адрес'});
    reply.header('Cache-Control','no-store');return pageMetadata(app,raw,env.siteUrl);
  });
  let template:Promise<string>|undefined=htmlTemplate===undefined?undefined:Promise.resolve(htmlTemplate);
  app.get('/*',async(request,reply)=>{
    if(request.url.startsWith('/api/')||request.url.startsWith('/uploads/'))return reply.code(404).send({error:'Не найдено'});
    template??=readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../dist/index.html'),'utf8').catch(cause=>{template=undefined;throw cause;});
    const metadata=await pageMetadata(app,request.url,env.siteUrl);
    reply.header('Cache-Control','no-store');return reply.code(metadata.status).type('text/html; charset=utf-8').send(renderMetadata(await template,metadata));
  });
}
