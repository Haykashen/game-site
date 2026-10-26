const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {parseName}=require('./extract-dns-catalog.cjs');
const {titleKey}=require('./lib/dns-catalog.cjs');
let load;try{({load}=require('cheerio'));}catch{({load}=require('../.deploy/tools/node_modules/cheerio'));}
const clean=s=>String(s??'').replace(/\s+/gu,' ').trim();
const aliases={
  'The Witcher 3':'The Witcher 3: Wild Hunt',
  'A Plague Tale: Innocence HD':'A Plague Tale: Innocence',
  'God of War 4':'God of War',
  "Marvel Spider-Man":"Marvel's Spider-Man",
  'Marvel Spider-Man 2':"Marvel's Spider-Man 2",
  'Resident Evil 2 Remake':'Resident Evil 2',
  'Resident Evil 3 Remake':'Resident Evil 3',
  'GTA 5: Grand Theft Auto V':'Grand Theft Auto V',
  'The Last Of Us II':'The Last of Us Part II',
  'Одни из нас 2':'The Last of Us Part II',
  'Одни из Нас':'The Last of Us',
  'Одни из нас - Обновленное издание':'The Last of Us Remastered',
  'Assassin\'s Creed: Вальгалла':"Assassin's Creed Valhalla",
  'Assassin\'s Creed Вальгалла':"Assassin's Creed Valhalla",
  'Assassin\'s Creed: Истоки':"Assassin's Creed Origins",
  'Assassin\'s Creed: Единство':"Assassin's Creed Unity",
  'Assassin\'s Creed: Одиссея':"Assassin's Creed Odyssey",
  'Assassin\'s Creed: Синдикат':"Assassin's Creed Syndicate",
  'Assassin\'s Creed IV Черный Флаг':"Assassin's Creed IV: Black Flag",
  'Assassin\'s Creed Изгой':"Assassin's Creed Rogue",
  'Assassin\'s Creed III. Обновленная версия':"Assassin's Creed III Remastered",
  'Assassin\'s Creed Эцио Аудиторе Коллекция':"Assassin's Creed: The Ezio Collection",
  'Horizon Запретный Запад':'Horizon Forbidden West',
  'Ratchet & Clank: Сквозь Миры':'Ratchet & Clank: Rift Apart',
  'Uncharted Наследие воров. Коллекция':'Uncharted: Legacy of Thieves Collection',
  'Uncharted: Натан Дрейк. Коллекция':'Uncharted: The Nathan Drake Collection',
  'Uncharted 4: Путь Вора':"Uncharted 4: A Thief's End",
  'Uncharted 3: Иллюзии Дрейка':"Uncharted 3: Drake's Deception",
  'Uncharted: Утраченное наследие':'Uncharted: The Lost Legacy',
  'LEGO Мир Юрского периода':'LEGO Jurassic World',
  'LEGO Хоббит':'LEGO The Hobbit',
  'LEGO Суперсемейка':'LEGO The Incredibles',
  'LEGO Marvel Мстители':"LEGO Marvel's Avengers",
  'LEGO Ниндзяго Фильм - Видеоигра':'The LEGO NINJAGO Movie Video Game',
  'LEGO Batman 3: Покидая Готэм':'LEGO Batman 3: Beyond Gotham',
  'LEGO Пираты Карибского моря':'LEGO Pirates of the Caribbean',
  'Ni no Kuni II: Возрождение Короля':'Ni no Kuni II: Revenant Kingdom',
  'God of War: Восхождение':'God of War: Ascension',
  'God of War 3 - Обновленная версия':'God of War III Remastered',
  'Batman Рыцарь Аркхема':'Batman: Arkham Knight',
  'Batman: Летопись Аркхема':'Batman: Arkham Origins',
  'Detroit Стать человеком':'Detroit: Become Human',
  'Средиземье: Тени Мордора':'Middle-earth: Shadow of Mordor',
  'Dragon Age: Инквизиция':'Dragon Age: Inquisition',
  'Tom Clancy\'s Rainbow Six: Осада':"Tom Clancy's Rainbow Six Siege",
  'Кровь и Истина':'Blood & Truth',
  'Дожить до рассвета':'Until Dawn',
  'Жизнь После':'Days Gone',
  'Сибирь 3':'Syberia 3',
  'The Elder Scrolls V: Skyrim':'The Elder Scrolls V: Skyrim',
  'Elder Scrolls IV: Oblivion Remastered':'The Elder Scrolls IV: Oblivion Remastered',
  'Ведьмак 3: Дикая охота':'The Witcher 3: Wild Hunt',
  'Ведьмак 3 Дикая Охота':'The Witcher 3: Wild Hunt',
  'Метро: Исход':'Metro Exodus',
  'Marvel Человек-Паук':"Marvel's Spider-Man",
  'Дурная репутация':'inFAMOUS',
  'Дурная репутация 2':'inFAMOUS 2',
  'За гранью: Две души':'Beyond: Two Souls',
  'Моя подружка Свинка Пеппа':'My Friend Peppa Pig',
  'Сорванец: Развёрнутая История':'Tearaway Unfolded',
  'Стартрек':'Star Trek',
  'Форсаж: Схватка':'Fast & Furious: Showdown',
  'LittleBigPlanet Картинг':'LittleBigPlanet Karting',
  'MotorStorm Апокалипсис':'MotorStorm: Apocalypse',
  'Пациент':'The Inpatient',
  'Battlefield 1 Революция':'Battlefield 1 Revolution',
  'Assassin\'s Creed: Откровения':"Assassin's Creed: Revelations",
  'Assassin\'s Creed Мираж':"Assassin's Creed Mirage",
  'Assassin\'s Creed Изгой - Обновленная версия':"Assassin's Creed Rogue Remastered",
  'Assassin\'s Creed 4 Черный Флаг':"Assassin's Creed IV: Black Flag",
  'LEGO Hobbit':'LEGO The Hobbit',
  'LEGO Lord of the Rings':'LEGO The Lord of the Rings',
  'LEGO The Ninjago Movie':'The LEGO NINJAGO Movie Video Game',
  'LEGO Гарри Поттер годы 5-7':'LEGO Harry Potter Years 5-7',
  'LEGO Harry Potter: Year 1-4':'LEGO Harry Potter Years 1-4',
  'LEGO Harry Potter: Year 5-7':'LEGO Harry Potter Years 5-7',
  'Джуманджи: Игра':'Jumanji: The Video Game',
  'Средиземье: Тени войны':'Middle-earth: Shadow of War',
  'Метро 2033: Луч Надежды':'Metro: Last Light',
  'Метро 2033: Возвращение':'Metro Redux',
  'Plants vs Zombies: Битва за Нейборвиль':'Plants vs. Zombies: Battle for Neighborville',
  'Ледниковый период: Сумасшедшее приключение Скрэта':"Ice Age: Scrat's Nutty Adventure",
  'Тачки 3: Навстречу победе':'Cars 3: Driven to Win',
  'Комплект игр Rayman Legends + Rayman Origins':'Rayman Legends + Rayman Origins',
  'Комплект игр Rayman Legends и Rayman Origins':'Rayman Legends + Rayman Origins',
  'Тропико 4':'Tropico 4',
  'Тропико 5':'Tropico 5',
  'Снупи Большое приключение':"The Peanuts Movie: Snoopy's Grand Adventure",
  'Call of Duty 4 Modern: Warfare Remastered':'Call of Duty: Modern Warfare Remastered',
  'Crysis Trilogy Remastered':'Crysis Remastered Trilogy',
  'F1 22':'F1 2022',
  'Far Cry 4 + Far Cry Primal':'Far Cry: Primal + Far Cry 4',
  'LEGO Movie: The Videogame':'LEGO Movie Videogame',
  'S.T.A.L.K.E.R. 2: Heart of Chornobyl':'S.T.A.L.K.E.R. 2: Heart of Chernobyl',
  'The Witcher 3 Wild Hunt':'The Witcher 3: Wild Hunt',
  'Syberia':'Syberia',
};
const aliasMap=new Map(Object.entries(aliases).map(([a,b])=>[titleKey(a),b]));
const additionalEditions=[
  'Uncaged Edition','Free Fall Edition','Nordic Edition','PS Move Edition','Safecracker Edition','Ultimate Sith Edition',
  'Frontrunner Edition','Extremely Evil Edition','Ambassador Edition','Platinum Edition','Bang!! Edition','Devinitive Edition',
  'Pets Edition','Double Shot Edition','Master Edition','Dynasty Edition','David Beckham Edition','Arcade Edition','Cyber Edition',
  'Medusa Edition','Nephilim Edition','The Pirate King Edition','Season Pass Edition','Imperium Edition','Limited Steelbook Edition Inc. Art Book',
  'Special Limited Edition','Extended Edition','Bloodhound Edition','Lifeline Edition','Full Clip Edition','Parklife Edition','The Fire Fades Edition',
  'Издание Исследователя','Ultimate Slasher Edition','Launch Day Edition','Six Edition','Bedrock Edition','Hero Edition','Gourmet Edition',
  'Crimewave Edition','Inaugural Flight Edition','Lightspeed Edition','Bonus Edition','Shiny Edition','Chosen Edition','Roland Garros Edition',
  'Auroa Edition','Washington, D.C. Edition','El Prez Edition','Jumbo Edition','Europa Edition','Critical Mass Edition','Revival Edition',
  'Occupied Edition','Steelbok Edition','Day Ichi Edition','Motherlobe Edition','Supreme Party Edition','Pure Fire Edition','Baron Edition',
  'Whiteout Edition','Twilight Rivals Edition','Rekindled Edition',"Tania's Edition",'Goat In A Box Edition','Archeologist Edition',
  "Commander's Edition",'Criminal Customs Edition','Fantabulous Edition',
  'Scholarship Edition','Hunter Edition','Prestige Edition','Silver Star Edition','Upper Echelon Edition',
  'Professional Edition','Radnet Edition','The Commander in Chief Edition','Apocalypse Edition','Advanced Edition',
  'Ultimate Team Edition','Minifigure Edition','Master Collection','Year One Survival Edition','European Battlefields Edition',
  'Starter Pack',
].sort((a,b)=>b.length-a.length);
function parseTitle(title,platform){
  const region=title.match(/(?:\(|\[| - )(EU|US|UK|ASIA|JAP|JP)(?: ver\.)?(?:\)|\]|$)/i)?.[1]?.toUpperCase();
  const russian=/русск(?:ая версия|ие субтитры)/iu.test(title);
  const english=/английская версия/iu.test(title);
  // "Russian version" alone does not establish the audio language.
  const voice=/русская озвучка|полностью на русском/iu.test(title)?['русский']:english?['английский']:[];
  const metadata=[];
  let name=clean(title.replace(/[[(](?=[^()[\]]*Xbox)[^()[\]]*[\])]/giu,'').replace(/Премьерное Издание \(Launch Edition\)/giu,'Launch Edition').replace(/Коллекционное издание \(Collectors Edition\)/giu,"Collector's Edition").replace(/\(([^()]*)\)|\[([^\[\]]*)\]/gu,(whole,a,b)=>{
    const inner=a??b;
    if(/PS[345]|Xbox|русск|английск|^(EU|US|UK|ASIA|JAP|JP)( ver\.)?$/iu.test(inner))return '';
    if(/поддерж|только для|PS\s*VR|PS Move|Limited Run|Cover|игра|Хиты PlayStation/iu.test(inner)){metadata.push(inner);return '';}
    if(/[а-яё]/iu.test(inner) && /[a-z]/i.test(title.slice(0,title.indexOf(whole))))return '';
    return whole;
  }).replace(/\s*\/\s*[А-ЯЁ].*$/u,'').replace(/\s*-\s*(EU|US|UK)$/i,'').replace(/\((?:II|III|IV|V|VI|VII|VIII|IX|X|\d+|FIFA \d+|GTA(?: \d+)?|GT7|NFS)\)/g,'').replace(/(?:^Б\/У\s+|\s*-\s*Б\/У$|\s+Предзаказ!|\s+Акция!)/giu,''));
  name=name.replace(/\s*\((?:Мираж|Тени|Росомаха|FIST|GTA Trilogy|SLG|Formula 1)\)/g,'').replace(/\s+для (?:PS[345]|Xbox\s+(?:360|One|Series X))$/i,'').replace(/\s+SALE!$/i,'');
  const withoutTranslation=name.replace(/\([^()]*\)/g,'').replace(/\s*\/.*$/,'').trim();
  if(aliasMap.has(titleKey(withoutTranslation)))name=withoutTranslation;
  // These labels are release variants rather than parts of game titles.
  const extra=/(?:[\s:.-]+)(Специальное издание(?: Аврора)?|Ограниченное издание|Лимитированное издание|Юбилейное издание|Стандартное издание|издание Игра года|Издание Игра Года|Премьерное Издание|(?:Shadow of the Erdtree|Komplete|Prepare to Die|Hardened|Helghast|Academy|Deathinitive|Heritage|Abducted|Possessed|Cursed|Legends|Exalted|Crewmate|Galactic|Stellar|Craft|Goat Overload|Pre-Udder|Devolver Deluxe|Devolver|Top Gun Maverick|20 Years?|Next Level|Next Gen|Nycrux|Oleti|Renegade|Tales|Ultima|Death|T-Rex|Neon|Atomic|Hell-A|Limidead) Edition|Steelbook|Ultimate|Deluxe)$/iu;
  const found=name.match(extra);if(found)name=name.slice(0,found.index).trim();
  const parsed=parseName(`${name} (${platform})`);
  const extraTags=[];let remainder=parsed.gameTitle;
  for(let i=0;i<4;i++){
    const suffix=additionalEditions.find(s=>remainder.toLowerCase().endsWith(' '+s.toLowerCase()));
    if(suffix){extraTags.unshift(remainder.slice(-suffix.length));remainder=remainder.slice(0,-suffix.length).replace(/[\s:.-]+$/g,'');continue;}
    const tag=remainder.match(extra);if(!tag)break;
    extraTags.unshift(tag[1]);remainder=remainder.slice(0,tag.index).trim();
  }
  parsed.gameTitle=remainder;
  if(extraTags.length)parsed.editionName=[...extraTags,parsed.editionName].filter(Boolean).join(' / ');
  const baseWithoutTranslation=parsed.gameTitle.replace(/\([^()]*\)/g,'').replace(/\s*\/.*$/,'').trim();
  if(aliasMap.has(titleKey(baseWithoutTranslation)))parsed.gameTitle=baseWithoutTranslation;
  let gameTitle=aliasMap.get(titleKey(parsed.gameTitle))??parsed.gameTitle;
  // Same English spelling with shop typography; keep sequel/remaster words.
  gameTitle=gameTitle.replace(/™|®/g,'').replace(/\s+/g,' ').trim();
  let editionName=[parsed.editionName,found?.[1]].filter(Boolean).join(' / ')||'стандартное издание';
  if(/издание Игра года/i.test(editionName))editionName='Game of the Year Edition';
  if(/^специальное издание$/i.test(editionName))editionName='Special Edition';
  if(/ограниченное издание|лимитированное издание/i.test(editionName))editionName='Limited Edition';
  if(/^Ведьмак 3\s*\/\s*Witcher: Дикая Охота Полное Издание 10 Years of Killing Monsters$/iu.test(gameTitle)){
    gameTitle='The Witcher 3: Wild Hunt';editionName='Complete Edition / 10 Years of Killing Monsters';
  }
  if(/^Disciples: Liberation - Издание$/i.test(gameTitle)){gameTitle='Disciples: Liberation';editionName='Deluxe Edition';}
  if(/^Prototype 2 Blackwatch$/i.test(gameTitle)){gameTitle='Prototype 2';editionName='Blackwatch';}
  if(/^Mad Max - Ripper$/i.test(gameTitle)){gameTitle='Mad Max';editionName='Ripper';}
  if(/^Sonic Mania Plus \+ Артбук$/i.test(gameTitle)){gameTitle='Sonic Mania Plus';editionName='С артбуком';}
  if(/^Minecraft \+ 3500 Minecoins$/i.test(gameTitle)){gameTitle='Minecraft';editionName='3500 Minecoins Bundle';}
  if(/^Crew Motorfest Cross-Gen Bundle$/i.test(gameTitle)){gameTitle='The Crew Motorfest';editionName='Cross-Gen Bundle';}
  if(/^Far Cry 3 \+ Far Cry 4 Double Pack$/i.test(gameTitle)){gameTitle='Far Cry 3 + Far Cry 4';editionName='Double Pack';}
  return {gameTitle,editionName,interfaceLanguages:russian?['русский']:english?['английский']:[],voiceLanguages:voice,region,metadata};
}
function extract(html,sourceFile){
  const filename=path.basename(sourceFile).toLowerCase();
  const platform=filename.match(/ps[345]/)?.[0].toUpperCase()??(filename.includes('xbox-series-x')?'Xbox Series X':filename.includes('xbox-one')?'Xbox One':filename.includes('xbox-360')?'Xbox 360':undefined);
  if(!platform)throw Error('Platform must be present in filename');
  const $=load(html),games=new Map(),seen=new Map(),warnings=[],skipped=[];
  $('.product-thumb').each((_,element)=>{
    const card=$(element),img=card.find('img.pic-1').first();
    const title=clean(img.attr('title')||img.attr('alt'));
    const sku=card.find('[onclick]').map((_,e)=>$(e).attr('onclick')).get().join(' ').match(/(?:cart|wishlist|compare)\.add\(['"](\d+)['"]/)?.[1];
    if(!title||!sku){warnings.push({title,reason:'missing title/product ID'});return;}
    if(/игровая валюта|подписка|карта оплаты|зарядная станция|без игры/iu.test(title)){skipped.push({title,sku,reason:'not a game'});return;}
    const resolvedPlatform=platform==='Xbox One'&&/Xbox Series X/i.test(title)&&!/Xbox One/i.test(title)?'Xbox Series X':platform;
    const id=`showgames-${sku}`,parsed=parseTitle(title,resolvedPlatform),key=titleKey(parsed.gameTitle);
    const url=new URL(img.attr('src'),'https://showgames.ru').href;
    if(!url.startsWith('https://showgames.ru/image/'))throw Error('Unexpected image URL: '+url);
    const product={id,sourceProvider:'showgames',sourceProductId:sku,sourceFile:path.basename(sourceFile),sourceTitle:title,
      productUrl:card.find('.image a').first().attr('href'),name:parsed.editionName,platforms:[resolvedPlatform],
      interfaceLanguages:parsed.interfaceLanguages,voiceLanguages:parsed.voiceLanguages,region:parsed.region,
      images:[url],image:url,releaseDate:null,sourcePriceText:clean(card.find('.price').text()),sourceNotes:parsed.metadata};
    if(resolvedPlatform!==platform)product.platformAnnotation={sourcePlatform:platform,resolvedPlatform,reason:'Source title explicitly says Xbox Series X, not Xbox One.'};
    const prior=seen.get(id);
    if(prior){if(prior.sourceTitle!==title||prior.image!==url)warnings.push({id,reason:'conflicting repeated product'});return;}
    seen.set(id,product);
    let game=games.get(key);
    if(!game){game={id,title:parsed.gameTitle,productIds:[],genres:[],sourceGameTitles:[],platforms:[]};games.set(key,game);}
    let group=game.platforms.find(p=>p.name===resolvedPlatform);if(!group){group={name:resolvedPlatform,editions:[]};game.platforms.push(group);}
    game.productIds.push(id);game.sourceGameTitles.push(title);group.editions.push(product);
  });
  return {schemaVersion:2,source:{type:'showgames-html',file:path.basename(sourceFile),sha256:createHash('sha256').update(html).digest('hex'),baseUrl:'https://showgames.ru',sourceCards:$('.product-thumb').length},
    games:[...games.values()],stats:{sourceCards:$('.product-thumb').length,uniqueProducts:seen.size,games:games.size,skipped:skipped.length},warnings,skipped,conventions:{}};
}
if(require.main===module){const [input,output]=process.argv.slice(2);const doc=extract(fs.readFileSync(input,'utf8'),input);fs.writeFileSync(output,JSON.stringify(doc,null,2)+'\n');console.log(JSON.stringify({source:doc.source,stats:doc.stats,warnings:doc.warnings,skipped:doc.skipped},null,2));}
module.exports={extract,parseTitle};
