const fs=require('node:fs');
function decode(value){return value.replace(/&(#x[\da-f]+|#\d+|amp|nbsp|quot|apos|lt|gt);/gi,(_,key)=>key[0]==='#'?String.fromCodePoint(parseInt(key.slice(key[1]?.toLowerCase()==='x'?2:1),key[1]?.toLowerCase()==='x'?16:10)):({amp:'&',nbsp:' ',quot:'"',apos:"'",lt:'<',gt:'>'})[key.toLowerCase()]);}
const normalize=value=>value.normalize('NFKC').replace(/[’‘`]/g,"'").trim().replace(/\s+/g,' ').toLowerCase();
function extract(html){
  const stack=[],names=[];
  for(const token of html.match(/<[^>]*>|[^<]+/g)??[]){
    if(/^<span\b/i.test(token)){stack.push({text:'',skip:/catalog-filter-count/i.test(token)||Boolean(stack.at(-1)?.skip)});}
    else if(/^<\/span\s*>/i.test(token)){
      const frame=stack.pop();if(!frame)throw Error('Unexpected closing span');
      if(frame.skip)continue;
      if(stack.length)stack.at(-1).text+=frame.text;
      else {const name=decode(frame.text).replace(/\s+/g,' ').trim();if(name&&!/^\d+$/.test(name))names.push(name);}
    }else if(stack.length&&!token.startsWith('<')&&!stack.at(-1).skip)stack.at(-1).text+=token;
  }
  if(stack.length)throw Error('Unclosed span');
  const unique=new Map();for(const name of names)if(!unique.has(normalize(name)))unique.set(normalize(name),name);
  return {names:[...unique.values()],spanNames:names.length,duplicates:names.length-unique.size};
}
module.exports={extract,normalize};
if(require.main===module){
  const result=extract(fs.readFileSync(process.argv[2],'utf8'));
  fs.mkdirSync('exports',{recursive:true});fs.writeFileSync('exports/game-series-import-2026-11-02.json',JSON.stringify(result,null,2)+'\n');
  const file='deploy/add-game-series.sh';const script=fs.readFileSync(file,'utf8');
  if(!/^const requested=.*;$/m.test(script))throw Error('Import payload not found');
  fs.writeFileSync(file,script.replace(/^const requested=.*;$/m,()=>`const requested=${JSON.stringify(result.names)};`));
  console.log(JSON.stringify({unique:result.names.length,duplicates:result.duplicates,sample:result.names.slice(0,8)}));
}
