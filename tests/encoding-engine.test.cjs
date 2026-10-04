const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./load-ts.cjs');
const codec = loadTs('src/lib/engines/encoding-engine.ts');

test('Base64 text uses UTF-8 and retains Unicode, BOM, whitespace and line endings', async () => {
  const original = '\ufeff  नमस्ते · مرحبا · café · 日本語 · 🧑🏽‍🚀\r\n\tend\n';
  const encoded = codec.base64EncodeText(original);
  assert.equal(encoded, Buffer.from(original, 'utf8').toString('base64'));
  const result = codec.base64DecodeToBlob(encoded);
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), Buffer.from(original, 'utf8'));
  assert.equal(await codec.decodedTextPreview(result), original);
});

test('Base64 preserves every byte value and identifies binary output without replacing bytes', async () => {
  const original = Buffer.from(Array.from({length: 256}, (_, i) => i));
  const result = codec.base64DecodeToBlob(original.toString('base64'));
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), original);
  assert.equal(await codec.decodedTextPreview(result), null);
  assert.equal(await codec.decodedTextPreview(new Blob([new Uint8Array([0x61, 0, 0x62])])), null);
  assert.equal(await codec.decodedTextPreview(new Blob([new Uint8Array([0xc3, 0x28])])), null);
});

test('Base64 accepts standard whitespace and unpadded payloads while rejecting malformed content', async () => {
  for (const value of ['Zg==', 'Zg', ' Z g = =\r\n', '\tZg==\n']) {
    assert.equal(await codec.base64DecodeToBlob(value).text(), 'f');
  }
  for (const value of ['%', 'Z', 'Z===', '=Zg=', 'Zg=Z', 'Zg===', 'data:text/plain;base64,Zg==', '__8=']) {
    assert.throws(() => codec.base64DecodeToBlob(value), /valid Base64/);
  }
  assert.equal(codec.base64DecodeToBlob('').size, 0);
  assert.equal(codec.base64EncodeText(''), '');
});

test('Base64 handles input larger than JavaScript spread argument limits', () => {
  const original = '🛫résumé\n'.repeat(30000);
  assert.equal(codec.base64EncodeText(original), Buffer.from(original).toString('base64'));
});

test('URL component encoding roundtrips Unicode, reserved characters and whitespace', () => {
  const input = '\ufeff नमस्ते /?a=1&b=+ #100% 🛫\r\n';
  const encoded = codec.urlEncode(input);
  assert.equal(encoded, encodeURIComponent(input));
  assert.match(encoded, /%2F%3Fa%3D1%26b%3D%2B/);
  assert.equal(codec.urlDecode(encoded), input);
  assert.equal(codec.urlEncode(''), '');
});

test('URL decoding explicitly distinguishes literal plus from form/query spaces', () => {
  assert.equal(codec.urlDecode('a+b%2Bc'), 'a+b+c');
  assert.equal(codec.urlDecode('a+b%2Bc', true), 'a b+c');
  assert.equal(codec.urlDecode('%2520'), '%20');
});

test('Malformed URL escapes and invalid Unicode never silently corrupt input', () => {
  for (const input of ['%', '%2', '%XY', '%FF', '%C3%28', '%ED%A0%80']) {
    assert.throws(() => codec.urlDecode(input), /malformed escape/);
  }
  for (const input of ['\ud800', '\udfff', 'a\ud800b']) {
    assert.throws(() => codec.base64EncodeText(input), /incomplete Unicode/);
    assert.throws(() => codec.urlEncode(input), /incomplete Unicode/);
    assert.throws(() => codec.urlDecode(input), /malformed escape/);
  }
});

test('Text uploads retain BOMs and reject invalid UTF-8 instead of introducing replacement characters', async () => {
  const text = '\ufeffrésumé\r\n';
  assert.equal(await codec.readEncodingTextFile(new File([text], 'utf8.txt')), text);
  await assert.rejects(codec.readEncodingTextFile(new File([new Uint8Array([0xff, 0xfe])], 'not-utf8.txt')), /valid UTF-8/);
  codec.assertEncodingFileSize(100 * 1024 * 1024);
  assert.throws(() => codec.assertEncodingFileSize(100 * 1024 * 1024 + 1), /100 MB/);
});

test('JWT engine consumer remains compatible with Unicode payloads', () => {
  const header = { alg: 'none', typ: 'JWT' }, payload = { name: 'अली 🛫', exp: 1700000000 };
  const token = [header, payload].map(part => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.') + '.';
  assert.deepEqual(codec.decodeJwt(token), { header, payload });
});
