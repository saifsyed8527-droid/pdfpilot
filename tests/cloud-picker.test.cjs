const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load() {
  const module = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync('src/lib/cloud-picker.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(require,module,module.exports);
  return module.exports;
}
const lib=load();
global.window = {};
const config={googleClientId:'test-client',googleApiKey:'test-key',googleAppId:'123',dropboxAppKey:'test-dropbox'};
const opts=(more={})=>({locale:'en',signal:new AbortController().signal,onDownload(){},accept:{'application/pdf':['.pdf']},...more});
const error=(code)=>e=>e instanceof lib.CloudPickerError && e.code===code;

test('native Workspace formats export only to a supported input and picker includes native documents',()=>{
 assert.deepEqual(lib.driveExport('application/vnd.google-apps.spreadsheet',{'application/octet-stream':['.xlsx','.xls']}),{extension:'xlsx',mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 assert.equal(lib.driveExport('application/vnd.google-apps.document',{'application/pdf':['.pdf']}).extension,'pdf');
 assert.throws(()=>lib.driveExport('application/vnd.google-apps.spreadsheet',{'image/png':['.png']}),error('unsupported'));
 assert.match(lib.pickerMimeTypes({'application/pdf':['.pdf']}),/google-apps.document/);
 assert.equal(lib.acceptsCloudFile(new File(['x'],'malware.exe',{type:'application/octet-stream'}),{'application/octet-stream':['.csv']}),false);
 assert.equal(lib.acceptsCloudFile(new File(['x'],'DATA.CSV',{type:'application/octet-stream'}),{'text/csv':['.csv']}),true);
});

test('streamed size limits, empty data and aborts cannot produce a successful file',async()=>{
 const signal=new AbortController();
 await assert.rejects(lib.readCloudFile(new Response('123456'),'test.pdf','application/pdf',5,signal.signal),error('size'));
 await assert.rejects(lib.readCloudFile(new Response(''),'test.pdf','application/pdf',5,signal.signal),error('empty'));
 await assert.rejects(lib.readCloudFile(new Response('x',{status:403}),'test.pdf','application/pdf',5,signal.signal),error('permission'));
 signal.abort();
 await assert.rejects(lib.readCloudFile(new Response('123'),'test.pdf','application/pdf',5,signal.signal),{name:'AbortError'});
 const file=await lib.readCloudFile(new Response('%PDF'), '../file.pdf','application/pdf',100,opts().signal);
 assert.equal(file.name,'.._file.pdf');assert.equal(await file.text(),'%PDF');
});

test('Dropbox direct URLs cannot point to arbitrary hosts, include credentials, or use HTTP',()=>{
 assert.equal(lib.dropboxDirectUrl('https://dl.dropboxusercontent.com/1/view/test/file.pdf'),'https://dl.dropboxusercontent.com/1/view/test/file.pdf');
 assert.ok(lib.dropboxDirectUrl('https://a.dl.dropboxusercontent.com/file'));
 for(const url of ['http://dl.dropboxusercontent.com/file','https://dropboxusercontent.com.evil.test/file','https://example.com/file','https://token@dl.dropboxusercontent.com/file','https://127.0.0.1/file','https://dl.dropboxusercontent.com:444/file']) assert.throws(()=>lib.dropboxDirectUrl(url));
});

test('Google private file download preserves bytes, checks metadata and only sends token to the fixed Drive API',async t=>{
 const {PDFDocument}=require('pdf-lib');const pdf=await PDFDocument.create();pdf.addPage();const bytes=await pdf.save();
 const calls=[];
 t.mock.method(global,'fetch',async(url,init)=>{calls.push({url,init});return url.includes('fields=') ? Response.json({name:'Private.pdf',mimeType:'application/pdf',size:String(bytes.length),capabilities:{canDownload:true}}) : new Response(bytes);});
 const files=await lib.downloadDriveFiles([{id:'selected-file-id',name:'ignored',mimeType:'application/pdf',url:'https://evil.test'}],'test-token',opts());
 assert.equal(files[0].name,'Private.pdf');assert.equal((await PDFDocument.load(await files[0].arrayBuffer())).getPageCount(),1);
 assert.equal(calls.length,2);assert.ok(calls.every(call=>call.url.startsWith('https://www.googleapis.com/drive/v3/files/selected-file-id')));
 assert.ok(calls.every(call=>call.init.headers.Authorization==='Bearer test-token'&&call.init.credentials==='omit'&&call.init.redirect==='error'));
 await assert.rejects(lib.downloadDriveFiles([{id:'../../evil'}],'test-token',opts()),error('download'));
});

test('Drive export uses Sheets XLSX bytes and rejects access-denied or oversized metadata before download',async t=>{
 const XLSX=require('xlsx');const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['Name','Value'],['Pens, blue',12]]),'Sheet1');
 const bytes=XLSX.write(workbook,{type:'buffer',bookType:'xlsx'});const calls=[];
 t.mock.method(global,'fetch',async(url)=>{calls.push(url);return url.includes('fields=')?Response.json({name:'Budget',mimeType:'application/vnd.google-apps.spreadsheet',capabilities:{canDownload:true}}):new Response(bytes);});
 const files=await lib.downloadDriveFiles([{id:'sheet-file'}],'token',opts({accept:{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx']}}));
 assert.equal(files[0].name,'Budget.xlsx');assert.match(calls[1],/\/export\?mimeType=/);
 const data=XLSX.read(await files[0].arrayBuffer());assert.equal(XLSX.utils.sheet_to_json(data.Sheets.Sheet1)[0].Name,'Pens, blue');
 global.fetch=async()=>Response.json({name:'blocked.pdf',mimeType:'application/pdf',size:'1000000000',capabilities:{canDownload:true}});
 await assert.rejects(lib.downloadDriveFiles([{id:'file'}],'token',opts()),error('size'));
 global.fetch=async()=>Response.json({name:'blocked.pdf',mimeType:'application/pdf',capabilities:{canDownload:false}});
 await assert.rejects(lib.downloadDriveFiles([{id:'file'}],'token',opts()),error('permission'));
});

test('Dropbox selection downloads without account tokens and a rejected batch never returns partial files',async t=>{
 const calls=[];t.mock.method(global,'fetch',async(url,init)=>{calls.push({url,init});return new Response('%PDF-1.7',{headers:{'Content-Type':'application/pdf'}});});
 const doc={link:'https://dl.dropboxusercontent.com/temporary/file.pdf',name:'file.pdf',bytes:8,isDir:false};
 const files=await lib.downloadDropboxFiles([doc],opts());assert.equal(await files[0].text(),'%PDF-1.7');assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.headers,undefined);
 await assert.rejects(lib.downloadDropboxFiles([doc,{...doc,bytes:200000000}],opts({multiple:true})),error('size'));
 await assert.rejects(lib.downloadDropboxFiles([doc,doc],opts()),error('count'));
 await assert.rejects(lib.downloadDropboxFiles([{...doc,isDir:true}],opts()),error('unsupported'));
});

test('official Dropbox picker is invoked inside the user click with direct links and cancellation is clean',async t=>{
 let callback;
 t.mock.property(global,'window',{Dropbox:{isBrowserSupported:()=>true,choose:options=>{callback=options;}}});
 const result=lib.pickCloudFiles('dropbox',opts({multiple:true}),config);
 assert.ok(callback,'SDK was invoked synchronously');assert.equal(callback.linkType,'direct');assert.equal(callback.multiselect,true);assert.deepEqual(callback.extensions,['.pdf']);assert.equal(callback.folderselect,false);
 callback.cancel();assert.deepEqual(await result,[]);
 const abort=new AbortController();const cancelled=lib.pickCloudFiles('dropbox',opts({signal:abort.signal}),config);abort.abort();await assert.rejects(cancelled,{name:'AbortError'});
 callback.success([]);
});

test('Google authentication requests only selected-file scope and handles denied access and closed popups',async t=>{
 let auth,request;
 t.mock.property(global,'window',{google:{picker:{},accounts:{oauth2:{initTokenClient:options=>{auth=options;return{requestAccessToken:options=>request=options};}}}}});
 const result=lib.pickCloudFiles('google-drive',opts(),config);
 assert.equal(auth.scope,'https://www.googleapis.com/auth/drive.file');assert.equal(auth.include_granted_scopes,false);assert.equal(request.prompt,'select_account');
 auth.error_callback({type:'popup_closed'});assert.deepEqual(await result,[]);
 const denied=lib.pickCloudFiles('google-drive',opts(),config);auth.callback({error:'access_denied'});await assert.rejects(denied,error('permission'));
});

test('Drive browsing keeps folder contents visible while only compatible files are selectable, including a separate shared-drive view',async t=>{
 let auth,callback,ready=0,disposed=0;
 const views=[];const built={};
 class DocsView {
  constructor(){this.options={};views.push(this);}
  setIncludeFolders(value){this.options.includeFolders=value;return this;}
  setSelectFolderEnabled(value){this.options.selectFolders=value;return this;}
  setEnableDrives(value){this.options.sharedDrivesOnly=value;return this;}
  setMode(value){this.options.mode=value;return this;}
  setMimeTypes(){assert.fail('Do not hide incompatible files and make populated folders appear empty');}
 }
 class PickerBuilder {
  addView(view){(built.views??=[]).push(view);return this;}
  setOAuthToken(){return this;} setDeveloperKey(){return this;} setAppId(){return this;}
  setOrigin(){return this;} setLocale(){return this;} setMaxItems(){return this;}
  setSelectableMimeTypes(value){built.selectable=value.split(',');return this;}
  setTitle(value){built.title=value;return this;} enableFeature(){return this;}
  setCallback(value){callback=value;return this;}
  build(){return {setVisible(value){built.visible=value;},dispose(){disposed++;}};}
 }
 t.mock.property(global,'window',{location:{origin:'https://pdfpilot.net'},google:{picker:{DocsView,PickerBuilder,DocsViewMode:{LIST:'list'},Feature:{MULTISELECT_ENABLED:'multi'},Action:{PICKED:'picked',CANCEL:'cancel',ERROR:'error'}},accounts:{oauth2:{initTokenClient(options){auth=options;return{requestAccessToken(){}};}}}}});
 const result=lib.pickCloudFiles('google-drive',opts({title:'Select PDF from Google Drive',onReady(){ready++;}}),config);
 auth.callback({access_token:'test-token'});
 assert.equal(views.length,2);assert.equal(views[0].options.sharedDrivesOnly,undefined);assert.equal(views[1].options.sharedDrivesOnly,true);
 assert.ok(views.every(view=>view.options.includeFolders===true&&view.options.selectFolders===false));
 assert.ok(built.selectable.includes('application/pdf'));assert.ok(built.selectable.includes('application/vnd.google-apps.document'));
 assert.ok(!built.selectable.includes('image/png'));assert.equal(built.title,'Select PDF from Google Drive');assert.equal(built.visible,true);assert.equal(ready,1);
 callback({action:'cancel'});assert.deepEqual(await result,[]);assert.equal(disposed,1);
 const failed=lib.pickCloudFiles('google-drive',opts(),config);auth.callback({access_token:'test-token'});
 const rejected=assert.rejects(failed,error('loading'));callback({action:'error'});await rejected;assert.equal(disposed,2);
});

test('Dropbox readiness, provider errors and blocked popups settle without leaving an active selection',async t=>{
 let callback,closed=0,ready=0;
 t.mock.property(global,'window',{Dropbox:{isBrowserSupported:()=>true,choose(options){callback=options;},cancelChooser(){closed++;callback.cancel();}}});
 const result=lib.pickCloudFiles('dropbox',opts({onReady(){ready++;}}),config);
 callback.ready();assert.equal(ready,1);
 const rejected=assert.rejects(result,error('loading'));callback.error();await rejected;assert.equal(closed,1);
 callback.ready();assert.equal(ready,1,'Late SDK readiness cannot reactivate a finished selection');
 window.Dropbox.choose=()=>{const failure=new Error('Failed to open window');failure.name='WindowFailedToOpenError';throw failure;};
 await assert.rejects(lib.pickCloudFiles('dropbox',opts(),config),error('popup'));
});

test('cancelling Dropbox closes its popup and ignores stale callbacks after reopening, even if SDK cleanup fails',async t=>{
 let callback,closed=0,downloads=0;
 t.mock.property(global,'window',{Dropbox:{isBrowserSupported:()=>true,choose(options){callback=options;},cancelChooser(){closed++;throw new Error('Window already detached');}}});
 t.mock.method(global,'fetch',async()=>{assert.fail('Cancelled selections must not download files');});
 const controller=new AbortController();
 const result=lib.pickCloudFiles('dropbox',opts({signal:controller.signal,onDownload(){downloads++;}}),config);
 const stale=callback;const rejected=assert.rejects(result,{name:'AbortError'});controller.abort();await rejected;
 assert.equal(closed,1);
 const reopened=lib.pickCloudFiles('dropbox',opts(),config);
 stale.success([{link:'https://dl.dropboxusercontent.com/test.pdf',name:'test.pdf',bytes:10,isDir:false}]);
 stale.cancel();assert.equal(downloads,0);
 callback.cancel();assert.deepEqual(await reopened,[]);
});

test('a provider that never sends response headers times out and aborts its request',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let signal;
 t.mock.method(global,'fetch',(_url,init)=>new Promise((resolve,reject)=>{signal=init.signal;signal.addEventListener('abort',()=>reject(signal.reason),{once:true});}));
 const pending=lib.downloadDriveFiles([{id:'slow-file'}],'token',opts());
 const rejected=assert.rejects(pending,error('download'));
 t.mock.timers.tick(20000);await rejected;assert.equal(signal.aborted,true);
});

test('a stalled file body times out, while active downloads get a fresh idle deadline after each chunk',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let stream,cancelled=0;
 const response=new Response(new ReadableStream({start(controller){stream=controller;},cancel(){cancelled++;}}));
 const pending=lib.readCloudFile(response,'slow.pdf','application/pdf',100,opts().signal);
 const rejected=assert.rejects(pending,error('download'));
 t.mock.timers.tick(25000);stream.enqueue(new TextEncoder().encode('%PDF'));
 await Promise.resolve();await Promise.resolve();
 t.mock.timers.tick(25000);assert.equal(cancelled,0,'Progress extends the idle deadline');
 t.mock.timers.tick(5000);await rejected;assert.equal(cancelled,1);
});

test('cancelling during a pending file read stops the stream immediately',async()=>{
 let cancelled=0;const controller=new AbortController();
 const response=new Response(new ReadableStream({cancel(){cancelled++;}}));
 const pending=lib.readCloudFile(response,'cancel.pdf','application/pdf',100,controller.signal);
 const rejected=assert.rejects(pending,{name:'AbortError'});controller.abort();await rejected;assert.equal(cancelled,1);
});
