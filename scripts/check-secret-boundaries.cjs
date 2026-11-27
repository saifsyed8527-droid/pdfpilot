// Focused commit/build guard, not a replacement for provider secret scanning.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const publicNames = new Set([
  // Vercel injects these documented public build identifiers automatically.
  // Keep an explicit list: future variables still require review, and every
  // allowed value still passes the secret checks below.
  // https://vercel.com/docs/environment-variables/framework-environment-variables
  'NEXT_PUBLIC_VERCEL_ENV',
  'NEXT_PUBLIC_VERCEL_TARGET_ENV',
  'NEXT_PUBLIC_VERCEL_URL',
  'NEXT_PUBLIC_VERCEL_BRANCH_URL',
  'NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL',
  'NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID',
  'NEXT_PUBLIC_VERCEL_PROJECT_ID',
  'NEXT_PUBLIC_VERCEL_GIT_PROVIDER',
  'NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG',
  'NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER',
  'NEXT_PUBLIC_VERCEL_GIT_REPO_ID',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_LOGIN',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_NAME',
  'NEXT_PUBLIC_VERCEL_GIT_PREVIOUS_SHA',
  'NEXT_PUBLIC_VERCEL_GIT_PULL_REQUEST_ID',
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_GA_MEASUREMENT_ID',
  // Legacy deployment ID only; no Clarity code or CSP permission remains.
  'NEXT_PUBLIC_CLARITY_PROJECT_ID',
  'NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID',
  'NEXT_PUBLIC_GOOGLE_PICKER_API_KEY',
  'NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID',
  'NEXT_PUBLIC_DROPBOX_APP_KEY',
]);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\bsb_secret_[A-Za-z0-9_-]{20,}\b/,
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s@/]+@/i,
];

function containsSecret(text) {
  if (secretPatterns.some(pattern => pattern.test(text))) return true;
  // Supabase legacy service-role JWTs are secrets; anon JWTs are public IDs.
  for (const token of text.matchAll(/\b[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\b/g)) {
    try {
      if (JSON.parse(Buffer.from(token[0].split('.')[1], 'base64url')).role === 'service_role') return true;
    } catch { /* Not a decodable JWT. */ }
  }
  return false;
}

function scanText(filename, text) {
  const issues = [];
  const basename = path.basename(filename);
  if ((/^\.env(?:\.|$)/.test(basename) && basename !== '.env.example') || /\.(?:pem|key)$/i.test(basename)) {
    issues.push(`${filename}: credential file must not be committed`);
  }
  text.split(/\r?\n/).forEach((line, index) => {
    if (containsSecret(line)) issues.push(`${filename}:${index + 1}: possible secret (value withheld)`);
    if (filename.startsWith('src/') || filename === 'next.config.ts' || basename.startsWith('.env')) {
      for (const match of line.matchAll(/\bNEXT_PUBLIC_[A-Z0-9_]+\b/g)) {
        if (!publicNames.has(match[0])) issues.push(`${filename}:${index + 1}: unreviewed public environment variable`);
      }
    }
  });
  return [...new Set(issues)];
}

function checkPublicEnv(env) {
  const issues = [];
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('NEXT_PUBLIC_') || !value) continue;
    if (!publicNames.has(name) || containsSecret(value)) {
      // Only a bounded identifier is diagnostic; never print its value.
      const identifier = /^NEXT_PUBLIC_[A-Z0-9_]{1,100}$/.test(name) ? name : '[invalid public identifier]';
      issues.push(`${identifier}: ${publicNames.has(name) ? 'possible secret' : 'unreviewed variable'} (value withheld)`);
    }
  }
  return [...new Set(issues)];
}

function scanRepository(root) {
  // Include staged and untracked, non-ignored candidates. CI scans the checkout.
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, maxBuffer: 16 * 1024 * 1024 })
    .toString().split('\0').filter(Boolean);
  const issues = [];
  for (const filename of new Set(files)) {
    const full = path.join(root, filename);
    if (!fs.existsSync(full) || !fs.lstatSync(full).isFile()) continue;
    const content = fs.readFileSync(full);
    // Filenames are checked even when a credential file contains binary data.
    issues.push(...scanText(filename, content.includes(0) ? '' : content.toString('utf8')));
  }
  return issues;
}

if (require.main === module) {
  try {
    const issues = checkPublicEnv(process.env);
    if (!process.argv.includes('--env-only')) issues.push(...scanRepository(process.cwd()));
    if (issues.length) {
      console.error(issues.join('\n'));
      process.exitCode = 1;
    } else console.log('Secret boundary checks passed (known patterns and public-variable allowlist only).');
  } catch {
    console.error('Secret boundary check could not complete. Run from a readable Git checkout.');
    process.exitCode = 1;
  }
}

module.exports = { scanText, scanRepository, checkPublicEnv };
