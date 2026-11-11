const fs=require('fs'),{loadTs}=require('./seo-load-ts.cjs');
const base='src/lib/i18n/';const table=(file,key)=>loadTs(base+file+'.ts').__tables[key];
const tools=loadTs('src/lib/tools.ts').TOOLS;const slugs=loadTs('src/lib/launch-catalog.ts').LOCALIZED_LAUNCH_TOOL_SLUGS;
const payload={
 CORE_COPY:table('core-content','CORE_COPY').en,
 SITE_PRIVACY:table('site-privacy','SITE_PRIVACY').en,
 TOOL_NAMES:table('ui-copy','TOOL_NAMES').en.split('|'),
 UI_ROWS:table('ui-copy','UI_KEYS'),
 HOME_ROWS:table('home-copy','HOME_KEYS'),
 WORKSPACE_ROWS:table('workspace-copy','KEYS'),
 CONVERSION_UI_ROWS:table('conversion-ui','CONVERSION_UI_KEYS'),
 CONVERSION_COPY:table('conversion-copy','CONVERSION_COPY').en,
 PDF_IMAGE_ROWS:table('pdf-image-copy','rows').en,
 PDF_IMAGE_LIMITS:table('pdf-image-copy','PDF_IMAGE_LIMITS').en,
 LABELS:table('localized-tools','LABELS').en,
 SUMMARIES:slugs.map(slug=>tools.find(t=>t.slug===slug).description),
 FORM_MARK_LABELS:loadTs('src/lib/editor/form-marks.ts').FORM_MARK_LABELS.en,
 catalog: Object.fromEntries(tools.map(t=>[t.slug,[t.name,t.description]])),
 language:{pairTitle:'Convert {from} to {to}',pairSummary:'Convert a {from} file to {to} in your browser.', 'markdown-table':'Markdown table', image:'image',text:'plain text',table:'Check headers, row counts and leading zeros in identifiers.',sql:'Check table names, columns and values in INSERT statements.',structure:'Review keys and nested elements. A flat table may represent data differently.',document:'Review headings, line breaks and reading order in the exported copy.',pixels:'Check dimensions and edges at 100% before sharing the image.',pages:'Check the first and last changed pages and keep the original PDF.',strings:'Try a short value with a known result first, including special characters.',check:'What to check',related:'Related tools'},
 cloud:require('../src/lib/i18n/cloud-copy.json').en,
 picker:require('../src/lib/i18n/cloud-picker-copy.json').en,
 nav:require('../src/lib/i18n/resource-nav.json').en,
 connections:require('../src/lib/connections/copy.json').en,
};
fs.mkdirSync('docs/seo/language-drafts',{recursive:true});fs.writeFileSync('docs/seo/language-drafts/en-source.json',JSON.stringify(payload,null,2)+'\n');
console.log('Source prepared',tools.length,'tools');
