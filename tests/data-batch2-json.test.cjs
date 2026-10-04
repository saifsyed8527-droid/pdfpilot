const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./load-ts.cjs');
const { formatJson, minifyJson, validateJson } = loadTs('src/lib/engines/format-engine.ts');

test('JSON formatting preserves unsafe integers, extreme exponents, negative zero and duplicate members', () => {
  const original = '{ "id": 9007199254740993, "x": 1, "x": 2, "tiny": 1e-400, "huge": 1e1000, "negative": -0, "decimal": 1.2300 }';
  const compact = '{"id":9007199254740993,"x":1,"x":2,"tiny":1e-400,"huge":1e1000,"negative":-0,"decimal":1.2300}';
  assert.equal(minifyJson(original), compact);
  for (const indent of [2, 4, 'tab']) assert.equal(minifyJson(formatJson(original, indent)), compact);
});

test('JSON strings preserve exact Unicode escapes, escaped punctuation and significant whitespace', () => {
  const original = String.raw` { "text": "  नमस्ते 🛫 ", "escapes": "\u0041\/\n\t\"\\", "surrogate": "\ud800", "punctuation": " { [ , : ] } " } `;
  const compact = String.raw`{"text":"  नमस्ते 🛫 ","escapes":"\u0041\/\n\t\"\\","surrogate":"\ud800","punctuation":" { [ , : ] } "}`;
  assert.equal(minifyJson(original), compact);
  assert.equal(minifyJson(formatJson(original)), compact);
  assert.deepEqual(JSON.parse(formatJson(original)), JSON.parse(original));
});

test('JSON indentation follows only actual structure and preserves empty objects and arrays', () => {
  assert.equal(formatJson('{"a":[1,{"b":[]},{}],"c":{}}'), '{\n  "a": [\n    1,\n    {\n      "b": []\n    },\n    {}\n  ],\n  "c": {}\n}');
  assert.equal(formatJson('{"a":1}',4), '{\n    "a": 1\n}');
  assert.equal(formatJson('{"a":1}','tab'), '{\n\t"a": 1\n}');
  assert.throws(()=>formatJson('{}',3),/indentation/);
  for (const value of ['true','false','null','42','"one two"','[]','{}']) {
    assert.equal(formatJson(' \r\n'+value+'\t'),value);
    assert.equal(minifyJson(' \r\n'+value+'\t'),value);
  }
});

test('JSON grammar errors report useful locations and never return partial formatted output', () => {
  const input = '{\n  "a": 1,\n}';
  const checked=validateJson(input);
  assert.equal(checked.valid,false);
  assert.equal(checked.line,3);
  assert.equal(checked.column,1);
  assert.equal(input[checked.offset],'}');
  const end=validateJson('{"a":');
  assert.equal(end.offset,5); assert.equal(end.line,1); assert.equal(end.column,6);
  for (const text of ['', ' ', '{"a":1,}', '[1,]', '{bad}', '{"a":NaN}', '01', '1 2', '{"x":"bad\nstring"}', '\ufeff{}']) {
    assert.equal(validateJson(text).valid,false,text);
    assert.throws(()=>formatJson(text),/valid JSON/);
    assert.throws(()=>minifyJson(text),/valid JSON/);
  }
});

test('Large JSON arrays retain meaningful values and member order through repeated formatting', () => {
  const values=Array.from({length:10000},(_,i)=>({index:i,text:'café, \"hi\"\n'+i,enabled:i%2===0,empty:null}));
  const source=JSON.stringify(values);
  const formatted=formatJson(source);
  assert.equal(minifyJson(formatted),source);
  assert.deepEqual(JSON.parse(formatted),values);
  assert.equal(formatJson(formatted),formatted);
});
