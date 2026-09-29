const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {load}=require('../scripts/load-pseo-modules.cjs');
const {detectQueryLanguage}=load('src/lib/pseo/query-language.ts');
const {portugueseIntent}=load('src/lib/pseo/portuguese.ts');
const {isLocaleIndexable}=load('src/lib/i18n/indexable-locales.ts');
const {importCsv,refreshLanguages}=require('../scripts/pseo-import.cjs');
const {build}=require('../scripts/pseo.cjs');
test('Brazil language comes from each query, not country or ranking URL',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pseo-br-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const f=path.join(dir,'br.csv');fs.writeFileSync(f,'Keyword,URL,Search Volume\nconverter pdf em word,https://example.com/en,823000\nconvert pdf to word,https://example.com/pt,165000\nconvertir pdf a word,https://example.com/pt,100\npdf,https://example.com/pt,50\n');const data=path.join(dir,'data');const result=importCsv(f,data,{market:'BR',language:'auto'});const rows=fs.readFileSync(path.join(data,'normalized',result.id+'.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.deepEqual(rows.map(r=>r.language),['pt-BR','en','es','und']);assert.ok(rows.every(r=>r.sourceMarket==='BR'));const ledger=build(data).ledger;assert.equal(ledger[0].status,'localized_core_page');assert.equal(ledger[1].canonicalUrl,'https://pdfpilot.net/pdf-to-word');assert.equal(ledger[2].reason,'query_language_review');
});
test('Portuguese conversion direction, synonyms and gaps are not conflated',()=>{
 for(const q of ['juntar pdf','unificar pdf','mesclar pdf'])assert.equal(portugueseIntent(q).toolId,'merge-pdf');
 assert.equal(portugueseIntent('converter pdf em word').toolId,'pdf-to-word');assert.equal(portugueseIntent('converter word para pdf').toolId,'word-to-pdf');assert.equal(portugueseIntent('converter doc para pdf').family,'unsupported');assert.equal(portugueseIntent('comprimir pdf para 100kb').family,'size');assert.equal(portugueseIntent('remover senha pdf').family,'unsupported');assert.equal(portugueseIntent('recuperar pdf apagado').family,'unsupported');
});
test('English OCR is not promised for Portuguese scans or PDF text conversion gaps',()=>{
 assert.equal(portugueseIntent('converter pdf digitalizado em word').reason,'portuguese_ocr_language_not_supported');assert.equal(portugueseIntent('pdf para txt').reason,'unsupported_conversion:pdf:txt');
});
test('Only reviewed language coverage enters reciprocal alternates and sitemaps',()=>{
 assert.equal(isLocaleIndexable('/pdf-to-word','pt-BR'),true);assert.equal(isLocaleIndexable('/pdf-to-word','fr'),false);assert.equal(isLocaleIndexable('/merge-pdf','fr'),true);assert.equal(isLocaleIndexable('/ocr-pdf','pt-BR'),false);assert.equal(isLocaleIndexable('/excel-to-xml','pt-BR'),false);
});
test('Portuguese distinct intents enter the existing review gate, not automatic publication',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pseo-br-review-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'source.csv');fs.writeFileSync(file,'Keyword\nconverter png em pdf\neditar curriculo pdf\neditar pdf no android\n');const data=path.join(dir,'data');importCsv(file,data,{market:'BR',language:'auto'});const result=build(data);assert.equal(result.approved.length,0);assert.deepEqual(result.candidates.map(p=>p.slug).sort(),['editar-curriculo-pdf','png-para-pdf']);assert.ok(result.candidates.every(p=>p.locale==='pt-br'&&p.canonicalUrl.includes('/pt-br/')&&p.rejectionReason.includes('editorial_review_required')));assert.equal(result.ledger[2].status,'localization_candidate');
});
test('Ambiguous and other-language observations stay reviewable',()=>{assert.equal(detectQueryLanguage('pdf'),'und');assert.equal(detectQueryLanguage('gabung pdf'),'und');assert.equal(detectQueryLanguage('editor de pdf'),'pt-BR');assert.equal(detectQueryLanguage('pdf converter'),'en');assert.equal(detectQueryLanguage('change pdf content'),'en');});

test('Language refresh cannot bless tampered normalized provenance',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pseo-br-integrity-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'source.csv');fs.writeFileSync(file,'Keyword\nconverter pdf em word\n');const data=path.join(dir,'data');const imported=importCsv(file,data,{market:'BR',language:'auto'});const normalized=path.join(data,'normalized',imported.id+'.jsonl');fs.appendFileSync(normalized,' ');assert.throws(()=>refreshLanguages(data),/Normalized source integrity failed/);
});
