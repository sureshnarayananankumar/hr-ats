/**
 * Verifies that Kong and the NestJS API allow exactly the same origins.
 *
 * Why this exists: the two lists live in different files (.env and
 * kong/kong.yml) and drifted during development. Kong allowed
 * http://127.0.0.1:5173 while the API did not, so requests passed the
 * gateway and were then refused by the backend — which looked like a
 * server fault rather than a configuration mistake.
 *
 *   node scripts/check-cors-consistency.mjs
 *
 * Exits non-zero on a mismatch, so it can be wired into CI.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

// ---- Backend: CORS_ORIGINS in .env ----
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
  console.error('No .env file found. Copy .env.example first.');
  process.exit(1);
}

const envText = fs.readFileSync(envPath, 'utf8');
const envMatch = envText.match(/^CORS_ORIGINS=(.*)$/m);
const backendOrigins = (envMatch?.[1] ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// ---- Kong: the cors plugin's origins block ----
const kongText = fs.readFileSync(path.join(root, 'kong', 'kong.yml'), 'utf8');

// Narrow the search to the cors plugin so an unrelated "origins:" key
// elsewhere in the file cannot be picked up by mistake.
const corsSection = kongText.split(/^\s*-\s*name:\s*cors\s*$/m)[1] ?? '';
const originsBlock = corsSection.match(/origins:\s*\n((?:\s*-\s*\S+\s*\n)+)/);
const kongOrigins = (originsBlock?.[1] ?? '')
  .split('\n')
  .map((line) => line.replace(/^\s*-\s*/, '').trim())
  .filter(Boolean);

// ---- Compare ----
const backendSet = new Set(backendOrigins);
const kongSet = new Set(kongOrigins);

const onlyInKong = kongOrigins.filter((origin) => !backendSet.has(origin));
const onlyInBackend = backendOrigins.filter((origin) => !kongSet.has(origin));

console.log('CORS origin consistency check\n');
console.log(`  Backend (.env)        ${backendOrigins.length} origin(s)`);
for (const origin of backendOrigins) console.log(`      ${origin}`);
console.log(`\n  Kong (kong/kong.yml)  ${kongOrigins.length} origin(s)`);
for (const origin of kongOrigins) console.log(`      ${origin}`);

// A wildcard with credentials would expose every authenticated endpoint
// to any website, so it is rejected outright rather than reported.
const wildcard = [...backendOrigins, ...kongOrigins].filter((origin) => origin.includes('*'));
if (wildcard.length > 0) {
  console.error(`\nFAIL: wildcard origin(s) present: ${wildcard.join(', ')}`);
  console.error('A wildcard is incompatible with credentialed requests.');
  process.exit(1);
}

if (onlyInKong.length === 0 && onlyInBackend.length === 0) {
  console.log('\nOK: both lists match.');
  process.exit(0);
}

console.error('\nFAIL: the lists do not match.\n');

if (onlyInKong.length > 0) {
  console.error('  Allowed by Kong but REJECTED by the API:');
  for (const origin of onlyInKong) console.error(`      ${origin}`);
  console.error('      -> requests from these pass the gateway, then fail at the backend.');
}

if (onlyInBackend.length > 0) {
  console.error('  Allowed by the API but blocked at Kong:');
  for (const origin of onlyInBackend) console.error(`      ${origin}`);
  console.error('      -> requests from these never reach the backend.');
}

console.error('\nUpdate CORS_ORIGINS in .env and the cors plugin in kong/kong.yml so they agree.');
process.exit(1);
