const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {load}=require('./load-pseo-modules.cjs');
const {normalizeKeyword}=load('src/lib/pseo/classify.ts');
const {detectQueryLanguage}=load('src/lib/pseo/query-language.ts');
const {keywordSchema}=load('src/lib/pseo/schema.ts');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const aliases={keyword:['keyword','keywords','query','search query','search term','term'],intent:['intent','intents','search intent','keyword intents'],searchVolume:['volume','search volume','sv','avg monthly searches','average monthly searches'],keywordDifficulty:['kd','kd %','keyword difficulty','keyword difficulty %','difficulty'],cpc:['cpc','cpc usd','cpc (usd)','cost per click'],competition:['competition','competitive density','com.','competition density'],serpFeatures:['serp features','serp feature','sf','serp features by keyword'],trend:['trend','trends'],results:['results','number of results','number of results in serp']};
const header=s=>s.normalize('NFKC').toLowerCase().replace(/^\uFEFF/,'').replace(/[^a-z0-9]+/g,' ').trim();
function parseCsv(text){
 text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/,1)[0];
 const delimiter=[',','\t',';'].map(d=>[d,first.split(d).length]).sort((a,b)=>b[1]-a[1])[0][0];
 let quote=false,closed=false,value='',cells=[],rows=[],line=1,start=1;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quote){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quote=false;closed=true;}}else{value+=c;if(c==='\n')line++;}continue;}
  if(c==='"'){if(value||closed)throw new Error(`Malformed quote on line ${line}`);quote=true;continue;}
  if(c===delimiter){cells.push(value);value='';closed=false;continue;}
  if(c==='\r'||c==='\n'){
   if(c==='\r'&&text[i+1]==='\n')i++;
   cells.push(value);rows.push({cells,line:start});cells=[];value='';closed=false;line++;start=line;continue;
  }
  if(closed&&!/\s/.test(c))throw new Error(`Unexpected text after quote on line ${line}`);
  if(!closed)value+=c;
 }
 if(quote)throw new Error('Unclosed CSV quote');
 if(value||cells.length||closed)rows.push({cells:[...cells,value],line:start});
 if(!rows.length)throw new Error('Empty CSV');
 return rows;
}
function numeric(value,field,warnings){
 const raw=(value??'').trim();if(!raw||['-','n/a','null'].includes(raw.toLowerCase()))return null;
 const compact=raw.replace(/[$%\s]/g,'');
 const m=compact.match(/^(\d+(?:,\d{3})*(?:\.\d+)?)([kKmM])?$/);
 if(!m){warnings.push(`invalid_${field}:${raw}`);return null;}
 const n=Number(m[1].replaceAll(',',''))*(m[2]?.toLowerCase()==='k'?1000:m[2]?.toLowerCase()==='m'?1000000:1);
 if(!Number.isFinite(n)||(field==='keywordDifficulty'&&n>100)){warnings.push(`invalid_${field}:${raw}`);return null;}
 return n;
}
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,value);fs.renameSync(tmp,file);}
function writeJson(file,value){atomic(file,JSON.stringify(value,null,2)+'\n');}
function importCsv(file,root,options){
 const market=options.market;
 if(!/^(?:[A-Z]{2}|UNKNOWN|GLOBAL)$/.test(market??''))throw new Error('Supply --market IN, US, GB, GLOBAL or UNKNOWN; source market is never guessed.');
 const language=options.language||'en';if(language!=='auto'&&!/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(language))throw new Error('Invalid language code');
 const bytes=fs.readFileSync(file);let decoded;
 if(bytes[0]===255&&bytes[1]===254)decoded=bytes.subarray(2).toString('utf16le');else decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 const parsed=parseCsv(decoded);const headers=parsed[0].cells;const normalizedHeaders=headers.map(header);
 // Distinct SEMrush fields such as Traffic and Traffic (%) must both survive in raw.
 // Alias ambiguity is checked separately below for fields the engine normalizes.
 if(new Set(headers.map(h=>h.normalize('NFKC').trim().toLowerCase())).size!==headers.length)throw new Error('Duplicate CSV headers; provide an unambiguous export.');
 const mapping={};
 for(const [key,names]of Object.entries(aliases)){
  const indexes=normalizedHeaders.flatMap((h,i)=>names.map(header).includes(h)?[i]:[]);
  if(indexes.length>1)throw new Error(`Ambiguous aliases for ${key}`);
  if(indexes.length)mapping[key]=indexes[0];
 }
 if(mapping.keyword===undefined)throw new Error('CSV has no supported keyword header');
 const sha256=digest(bytes);const id=digest(JSON.stringify({sha256,market,language,provider:options.provider??null,snapshot:options.snapshot??null})).slice(0,24);
 const stateFile=path.join(root,'manifests/state.json');const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)): {version:1,sources:[]};
 if(state.sources.some(s=>s.id===id))return {id,reimport:true,rows:state.sources.find(s=>s.id===id).rows};
 const rows=[];
 for(const record of parsed.slice(1)){
  const raw=Object.fromEntries(headers.map((h,i)=>[h,record.cells[i]??'']));
  if(record.cells.length>headers.length)raw.__extra_cells=JSON.stringify(record.cells.slice(headers.length));
  const warnings=record.cells.length!==headers.length?[`column_count:${record.cells.length}_expected_${headers.length}`]:[];
  const get=k=>mapping[k]===undefined?'':record.cells[mapping[k]]??'';
  const metrics=Object.fromEntries(['searchVolume','keywordDifficulty','cpc','competition','results'].map(k=>[k,numeric(get(k),k,warnings)]));
  rows.push(keywordSchema.parse({id:`${id}:${record.line}`,keyword:get('keyword'),normalizedKeyword:normalizeKeyword(get('keyword')),raw,...metrics,intent:get('intent'),trend:get('trend'),serpFeatures:get('serpFeatures').split(/[,;|]/).map(s=>s.trim()).filter(Boolean),sourceDataset:id,sourceFile:path.basename(file),sourceRowId:record.line,sourceMarket:market,language:language==='auto'?detectQueryLanguage(get('keyword')):language,warnings}));
 }
 const originalName=path.basename(file);const original=path.join(root,'sources',market,id,originalName);
 fs.mkdirSync(path.dirname(original),{recursive:true});
 if(fs.existsSync(original)){if(digest(fs.readFileSync(original))!==sha256)throw new Error('Raw source integrity mismatch');}
 else fs.writeFileSync(original,bytes,{flag:'wx'});
 const normalizedBytes=rows.map(r=>JSON.stringify(r)).join('\n')+'\n';
 const source={id,sha256,normalizedSha256:digest(normalizedBytes),originalFile:originalName,rawPath:path.relative(root,original),market,language,provider:options.provider??null,snapshot:options.snapshot??null,importedAt:options.date??new Date().toISOString().slice(0,10),rows:rows.length,headers,mapping};
 atomic(path.join(root,'normalized',id+'.jsonl'),normalizedBytes);
 state.sources.push(source);state.sources.sort((a,b)=>a.id.localeCompare(b.id));writeJson(stateFile,state);
 return {id,reimport:false,rows:rows.length};
}
function refreshLanguages(root){
 const file=path.join(root,'manifests/state.json'),state=JSON.parse(fs.readFileSync(file));let changed=0;
 for(const source of state.sources.filter(s=>s.language==='auto')){
  const f=path.join(root,'normalized',source.id+'.jsonl');
  if(digest(fs.readFileSync(path.join(root,source.rawPath)))!==source.sha256)throw new Error(`Raw source integrity failed: ${source.id}`);
  if(digest(fs.readFileSync(f))!==source.normalizedSha256)throw new Error(`Normalized source integrity failed: ${source.id}`);
  const rows=fs.readFileSync(f,'utf8').trim().split('\n').map(JSON.parse);
  for(const row of rows){const language=detectQueryLanguage(row.keyword);if(row.language!==language)changed++;row.language=language;}
  const bytes=rows.map(r=>JSON.stringify(r)).join('\n')+'\n';atomic(f,bytes);source.normalizedSha256=digest(bytes);source.languageMethod='query-lexicon-v1; ambiguous queries held as und; source market never consulted';
 }
 writeJson(file,state);return {changed};
}
module.exports={refreshLanguages,parseCsv,numeric,importCsv,atomic,writeJson,digest};
