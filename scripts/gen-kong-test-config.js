/**
 * Generates kong/kong.test.yml from kong/kong.yml.
 *
 * The test config is identical in routing, CORS, header stripping and
 * request-size policy — ONLY the rate-limit counters are raised, so a
 * full smoke-test run is not throttled by its own logins.
 *
 * Generating it (rather than maintaining a second file by hand) means
 * the test gateway can never drift from the real security policy.
 *
 *   node scripts/gen-kong-test-config.js
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'kong', 'kong.yml');
const target = path.join(root, 'kong', 'kong.test.yml');

let config = fs.readFileSync(source, 'utf8');

config = config.replace(
  '#  Kong Gateway — declarative (DB-less) configuration',
  [
    '#  Kong Gateway — TEST configuration (GENERATED, do not edit)',
    '#',
    '#  Generated from kong/kong.yml by scripts/gen-kong-test-config.js.',
    '#  DO NOT USE IN PRODUCTION. Routing, CORS, identity-header',
    '#  stripping and request-size limits are identical to the real',
    '#  config; only the rate-limit counters are raised.',
  ].join('\n'),
);

const minuteCount = (config.match(/minute: \d+/g) || []).length;
const hourCount = (config.match(/hour: \d+/g) || []).length;

config = config.replace(/minute: \d+/g, 'minute: 2000');
config = config.replace(/hour: \d+/g, 'hour: 20000');

fs.writeFileSync(target, config);

const production = fs.readFileSync(source, 'utf8');

console.log(`Wrote ${path.relative(root, target)}`);
console.log(`  raised ${minuteCount} per-minute and ${hourCount} per-hour limits`);
console.log(
  `  production kong.yml still has the strict login limit: ${production.includes('minute: 5')}`,
);
