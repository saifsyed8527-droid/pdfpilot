const fs = require('node:fs');
const { load } = require('./load-pseo-modules.cjs');
const { DOCUMENT_TEMPLATES, DOCUMENT_CATEGORIES } = load('src/lib/content/document-templates.ts');
const { PDF_WORKFLOWS } = load('src/lib/content/pdf-workflows.ts');
const rows = [
  ...DOCUMENT_TEMPLATES.map(row => ({ family: 'document_template', path: '/templates/' + row.slug, title: row.name, category: row.category, action: 'Create a fillable PDF', evidence: '/template-samples/documents/' + row.slug + '.pdf', release: row.slug === 'invoice-template' ? 'updated' : 'new' })),
  ...PDF_WORKFLOWS.map(row => ({ family: 'workflow', path: '/pdf-workflows/' + row.slug, title: row.title, category: row.input, action: row.steps.join(' -> '), evidence: row.samples.map(name => '/template-samples/' + name).join(' | '), release: 'new' })),
  { family: 'hub', path: '/templates', title: 'Free editable PDF templates', release: 'new' },
  ...Object.entries(DOCUMENT_CATEGORIES).map(([category, row]) => ({ family: 'collection', path: '/templates/collections/' + category, title: row.title, category, release: 'new' })),
  { family: 'hub', path: '/pdf-workflows', title: 'PDF workflows', release: 'new' },
];
const keys = ['family', 'path', 'title', 'category', 'action', 'evidence', 'release'];
const cell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
fs.writeFileSync('docs/pseo-page-manifest.csv', [keys.map(cell).join(','), ...rows.map(row => keys.map(key => cell(row[key])).join(','))].join('\n') + '\n');
console.log(JSON.stringify({ rows: rows.length, new: rows.filter(row => row.release === 'new').length, updated: rows.filter(row => row.release === 'updated').length }));
