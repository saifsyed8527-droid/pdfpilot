// QA request evidence only. Does not block, modify or replay network requests.
const { createHash } = require('node:crypto');
function capturePosts(page, base, records) {
  page.on('request', request => {
    if (request.method() !== 'POST') return;
    const body = request.postDataBuffer() || Buffer.alloc(0), text = body.toString('utf8');
    const url = new URL(request.url()), contentType = request.headers()['content-type'] || '';
    const keys = [...new URLSearchParams(text).keys()];
    const metadata = keys.every(key => /^(en|_ee|_et|ep\.(tool_name|error_message|method|value|search_term)|epn\.[a-z_]+)$/.test(key));
    const collection = ['www.google-analytics.com', 'region1.google-analytics.com', 'analytics.google.com'].includes(url.hostname) && url.pathname === '/g/collect';
    const documentMarker = /%PDF-|JVBERi|application\/pdf|multipart\/form-data|iVBORw0KGgo|data:image/i.test(text + ' ' + contentType);
    const classification = collection && body.length < 8192 && metadata && !documentMarker ? 'GA event metadata; manually review retained URL/body' : request.url() === base + '/__nextjs_original-stack-frames' ? 'Next local diagnostic' : 'requires investigation';
    records.push({ url: request.url(), contentType, bytes: body.length, body: text.slice(0, 65536), sha256: createHash('sha256').update(body).digest('hex'), keys, documentMarker, classification });
  });
}
module.exports = { capturePosts };
