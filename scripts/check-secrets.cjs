// Conservative secret tripwire. Prints locations/rule names, never matched values.
// Does not replace provider-side secret scanning or credential rotation.
const fs=require('node:fs'),{execFileSync,spawn}=require('node:child_process'),readline=require('node:readline');
const rules=[
 ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
 ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{60,})\b/],
 ['aws-access-id', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
 ['provider-secret', /\b(?:sk_live_[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{30,}|xox[baprs]-[A-Za-z0-9-]{20,})\b/],
 ['credential-url', /\b(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\/[^\s/:]+:[^\s/@]{8,}@/],
];
const findings=[];
const scan=(line,location)=>{for(const [name,re] of rules)if(re.test(line))findings.push({location,rule:name});};
async function main(){
 const paths=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8',maxBuffer:8*1024*1024}).split('\0').filter(Boolean))];
 for(const file of paths){
  if(/(?:^|\/)\.env(?:\.|$)/.test(file)&&!file.endsWith('.example'))findings.push({location:file,rule:'tracked-env-file'});
  if(!fs.existsSync(file)||fs.statSync(file).size>8*1024*1024)continue;
  const bytes=fs.readFileSync(file);if(bytes.includes(0))continue;
  bytes.toString('utf8').split('\n').forEach((line,i)=>scan(line,`${file}:${i+1}`));
 }
 if(process.argv.includes('--history')){
  const child=spawn('git',['log','--all','--format=COMMIT:%H','--no-ext-diff','-p','--','*.ts','*.tsx','*.js','*.cjs','*.mjs','*.json','*.yml','*.yaml','*.env*','*.pem','*.key']);
  let commit='',file='';
  for await(const line of readline.createInterface({input:child.stdout})){
   if(line.startsWith('COMMIT:'))commit=line.slice(7);
   else if(line.startsWith('+++ b/'))file=line.slice(6);
   else if(line.startsWith('+')&&!line.startsWith('+++'))scan(line,`${commit}:${file}`);
  }
  const status=await new Promise(resolve=>{if(child.exitCode!==null)resolve(child.exitCode);else child.on('close',resolve);});
  if(status!==0)throw new Error('Git history scan failed');
 }
 console.log(JSON.stringify({mode:process.argv.includes('--history')?'working files and local Git history':'working files',filesScanned:paths.length,findings},null,2));
 if(findings.length)process.exitCode=1;
}
main().catch(()=>{console.error('Secret scan failed; results are incomplete.');process.exitCode=1;});
