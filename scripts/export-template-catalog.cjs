// Manual CSV export for Google Sheets/Excel review. No accounts, scheduler or publishing.
const fs=require('node:fs');
const path=require('node:path');
const rows=require('../src/lib/content/conversion-templates.json');
const columns=['tool','slug','title','description','input','output','preset','samples','facts','checks','question','answer','tags','legacy'];
const cell=value=>'"'+(typeof value==='object'?JSON.stringify(value):String(value??'')).replaceAll('"','""')+'"';
const output=path.resolve(__dirname,'../docs/conversion-template-catalog.csv');
fs.writeFileSync(output,[columns.map(cell).join(','),...rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n')+'\r\n');
console.log(`${rows.length} template rows exported to ${output}. CSV is a review mirror; the validated JSON catalog drives builds.`);
