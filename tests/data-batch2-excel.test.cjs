const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const XLSX=require('xlsx'),{xml2js}=require('xml-js'),{unzipSync}=require('fflate');
const {convertExcel,inspectExcel,bundleExcelOutputs,DEFAULT_EXCEL_OPTIONS}=require('../src/lib/engines/excel-conversion-engine.ts');
function workbookFile(sheets) {const wb=XLSX.utils.book_new();for(const [name,sheet] of Object.entries(sheets))XLSX.utils.book_append_sheet(wb,sheet,name);return new File([XLSX.write(wb,{type:'buffer',bookType:'xlsx'})],'unicode.xlsx');}
function options(extra={}){return {...DEFAULT_EXCEL_OPTIONS,...extra};}

test('Excel XML retains combining marks in Unicode headers and original text, rows, selected sheet order and ZIP entries',async()=>{
 const file=workbookFile({Data:XLSX.utils.aoa_to_sheet([['नाम','cafe\u0301','नाम',''],['अली & <मूल>','quoted "value"\r\nnext',0,false],['00123','🛫','',true]]),Other:XLSX.utils.aoa_to_sheet([['Key'],['second sheet']])});
 assert.deepEqual((await inspectExcel(file)).sheets.map(s=>s.name),['Data','Other']);
 const outputs=await convertExcel(file,options({sheets:['Other','Data']}));
 assert.equal(outputs.length,2);assert.match(outputs[0].name,/_1_Other\.xml$/);assert.match(outputs[1].name,/_2_Data\.xml$/);
 const parsed=xml2js(await outputs[1].blob.text(),{compact:true}).rows.row;
 assert.equal(parsed[0]['नाम']._text,'अली & <मूल>');assert.equal(parsed[0]['cafe\u0301']._text,'quoted "value"\nnext'); // SheetJS normalizes workbook CRLF line endings to LF.
 assert.equal(parsed[0]['नाम_2']._text,'0');assert.equal(parsed[0].field_4._text,'FALSE');assert.equal(parsed[1]['नाम']._text,'00123');
 const archive=unzipSync(new Uint8Array(await (await bundleExcelOutputs(outputs)).arrayBuffer()));assert.deepEqual(Object.keys(archive),outputs.map(o=>o.name));
 for(const output of outputs)assert.deepEqual(Buffer.from(archive[output.name]),Buffer.from(await output.blob.arrayBuffer()));
});

test('Excel XML raw-value option prevents display rounding while the default retains saved display formats',async()=>{
 const sheet=XLSX.utils.aoa_to_sheet([['Rate','Amount','Code','Date','Flag'],[0.123456,123.456,'00123',45292,false]]);
 sheet.A2.z='0%';sheet.B2.z='0.00';sheet.D2.z='yyyy-mm-dd';
 const file=workbookFile({Data:sheet});
 const formatted=xml2js(await (await convertExcel(file,options()))[0].blob.text(),{compact:true}).rows.row;
 assert.equal(formatted.Rate._text,'12%');assert.equal(formatted.Amount._text,'123.46');assert.equal(formatted.Date._text,'2024-01-01');assert.equal(formatted.Flag._text,'FALSE');
 const raw=xml2js(await (await convertExcel(file,options({xmlValues:'raw'})))[0].blob.text(),{compact:true}).rows.row;
 assert.equal(raw.Rate._text,'0.123456');assert.equal(raw.Amount._text,'123.456');assert.equal(raw.Code._text,'00123');assert.equal(raw.Date._text,'45292');assert.equal(raw.Flag._text,'false');
});

test('Excel data exports reject missing formula caches with sheet/cell diagnostics, while genuine cached zero is retained',async()=>{
 const missing=workbookFile({Data:{A1:{t:'s',v:'Total'},A2:{t:'n',f:'1+2'},'!ref':'A1:A2'}});
 for(const format of ['xml','csv'])await assert.rejects(convertExcel(missing,options({format})),/Worksheet "Data".*A2.*Recalculate/);
 const cached=workbookFile({Data:{A1:{t:'s',v:'Total'},A2:{t:'n',f:'1-1',v:0},'!ref':'A1:A2'}});
 assert.equal(xml2js(await (await convertExcel(cached,options()))[0].blob.text(),{compact:true}).rows.row.Total._text,'0');
});

test('Excel headerless XML retains the first row and malformed XML characters fail without a partial output',async()=>{
 const file=workbookFile({Data:XLSX.utils.aoa_to_sheet([['first','second'],['value',1]])});
 const rows=xml2js(await (await convertExcel(file,options({headerRow:false})))[0].blob.text(),{compact:true}).rows.row;
 assert.equal(rows.length,2);assert.equal(rows[0].field_1._text,'first');
 const invalid=workbookFile({Data:XLSX.utils.aoa_to_sheet([['Header'],['bad\u0001cell']])});
 await assert.rejects(convertExcel(invalid,options()),/XML cannot represent/);
});

test('Excel error cells are retained as displayed error values instead of silently becoming blank',async()=>{
 const file=workbookFile({Data:{A1:{t:'s',v:'Error'},A2:{t:'e',v:7},'!ref':'A1:A2'}});
 for(const xmlValues of ['formatted','raw']) {
  const output=await convertExcel(file,options({xmlValues}));
  assert.equal(xml2js(await output[0].blob.text(),{compact:true}).rows.row.Error._text,'#DIV/0!');
 }
});
