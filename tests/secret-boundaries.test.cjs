const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { scanText, scanRepository, checkPublicEnv } = require('../scripts/check-secret-boundaries.cjs');
const secret = ['sb', 'secret', 'a'.repeat(30)].join('_');

test('blocks credential filenames, including nested and binary candidates', () => {
  for (const name of ['.env', '.env.production', 'config/.env.backup', 'key.pem', 'key.key']) {
    assert.ok(scanText(name, '').length, name);
  }
  assert.deepEqual(scanText('.env.example', '# Empty placeholders only'), []);
});

test('rejects known secret formats without returning their values', () => {
  const tokens = [secret, ['ghp', 'a'.repeat(40)].join('_'), ['sk', 'live', 'a'.repeat(30)].join('_'),
    ['-----BEGIN', 'PRIVATE KEY-----'].join(' '), ['postgresql://', 'user:password@example.test/db'].join('')];
  for (const token of tokens) {
    const findings = scanText('src/example.ts', `const credential = '${token}';`);
    assert.ok(findings.length);
    assert.ok(!findings.join().includes(token));
  }
});

test('distinguishes legacy service-role JWTs from public anon JWTs', () => {
  const jwt = role => [Buffer.from('{}').toString('base64url'), Buffer.from(JSON.stringify({ role })).toString('base64url'), 'signature'].join('.');
  assert.ok(scanText('config.ts', jwt('service_role')).length);
  assert.deepEqual(scanText('config.ts', jwt('anon')), []);
});

test('blocks unreviewed public variables and secrets disguised as allowed values', () => {
  const name = ['NEXT', 'PUBLIC', 'SERVICE', 'KEY'].join('_');
  assert.ok(scanText('src/client.ts', `process.env.${name}`).length);
  assert.ok(checkPublicEnv({ [name]: 'value' }).length);
  assert.ok(checkPublicEnv({ NEXT_PUBLIC_GA_MEASUREMENT_ID: secret }).length);
  assert.deepEqual(checkPublicEnv({ NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-EXAMPLE', SERVER_SECRET: secret }), []);
});

test('accepts documented Vercel metadata but rejects unknown names and secret values', () => {
  const metadata = {
    NEXT_PUBLIC_VERCEL_ENV: 'preview',
    NEXT_PUBLIC_VERCEL_URL: 'pdfpilot-example.vercel.app',
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE: 'Fix deployment metadata validation',
  };
  assert.deepEqual(checkPublicEnv(metadata), []);
  for (const name of Object.keys(metadata)) {
    assert.ok(checkPublicEnv({ [name]: secret }).length);
  }
  const unreviewed = ['NEXT_PUBLIC_VERCEL', 'NEW_VARIABLE'].join('_');
  assert.ok(checkPublicEnv({ [unreviewed]: 'value' }).length);
  assert.match(checkPublicEnv({ [unreviewed]: secret }).join(), /NEXT_PUBLIC_VERCEL_NEW_VARIABLE/);
  assert.ok(!checkPublicEnv({ [unreviewed]: secret }).join().includes(secret));
  assert.ok(!checkPublicEnv({ ['NEXT_PUBLIC_\n' + secret]: secret }).join().includes(secret));
});

test('repository scan catches tracked ignored env and new source, never scans ignored local secrets', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'pdfpilot-secrets-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    writeFileSync(path.join(root, '.gitignore'), '.env*\n');
    writeFileSync(path.join(root, '.env.local'), secret);
    assert.deepEqual(scanRepository(root), []);
    execFileSync('git', ['add', '-f', '.env.local'], { cwd: root });
    writeFileSync(path.join(root, 'new.ts'), secret);
    const issues = scanRepository(root);
    assert.ok(issues.some(value => value.includes('.env.local')));
    assert.ok(issues.some(value => value.includes('new.ts')));
    assert.ok(!issues.join().includes(secret));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI fails closed and redacts values; env-only mode works without Git', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'pdfpilot-secrets-cli-'));
  const script = path.resolve(__dirname, '../scripts/check-secret-boundaries.cjs');
  try {
    const run = (args, env = {}) => spawnSync(process.execPath, [script, ...args], { cwd: root, env, encoding: 'utf8' });
    assert.equal(run([]).status, 1);
    assert.equal(run(['--env-only']).status, 0);
    const result = run(['--env-only'], { NEXT_PUBLIC_GA_MEASUREMENT_ID: secret });
    assert.equal(result.status, 1);
    assert.ok(!`${result.stdout}${result.stderr}`.includes(secret));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
