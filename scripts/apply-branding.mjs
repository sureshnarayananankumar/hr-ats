/**
 * Applies Business Gateways branding across the frontend.
 *
 * Idempotent: safe to re-run. Each edit checks for its own marker first,
 * so running it twice does not duplicate imports or double-apply text.
 *
 *   node scripts/apply-branding.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const fe = (relative) => path.join(root, 'frontend', relative);

const results = [];
const record = (label, ok) => results.push({ label, ok });

function patch(file, edits) {
  const full = fe(file);
  let text = fs.readFileSync(full, 'utf8');
  let changed = false;

  for (const [find, replace] of edits) {
    if (text.includes(find)) {
      text = text.replace(find, replace);
      changed = true;
    }
  }

  if (changed) fs.writeFileSync(full, text);
  return text;
}

// ---------------------------------------------------------------------
//  1. Logo import on the careers pages
// ---------------------------------------------------------------------
const LOGO_IMPORT = "import { Logo } from '@/components/ui/Logo';";
const SELECT_IMPORT = "import { Select } from '@/components/ui/select';";

for (const file of ['src/pages/careers/CareersListPage.tsx', 'src/pages/careers/CareersDetailPage.tsx']) {
  const current = fs.readFileSync(fe(file), 'utf8');
  if (!current.includes(LOGO_IMPORT)) {
    patch(file, [[SELECT_IMPORT, `${SELECT_IMPORT}\n${LOGO_IMPORT}`]]);
  }
  record(`${path.basename(file)} logo import`, fs.readFileSync(fe(file), 'utf8').includes(LOGO_IMPORT));
}

// ---------------------------------------------------------------------
//  2. Careers detail header -> wordmark
// ---------------------------------------------------------------------
patch('src/pages/careers/CareersDetailPage.tsx', [
  [
    '          <Link to="/careers" className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary">\n            <ArrowLeft className="size-4" aria-hidden="true" />\n            All openings\n          </Link>',
    '          <div className="flex items-center gap-4">\n            <Logo width={140} />\n            <Link to="/careers" className="inline-flex items-center gap-2 border-l pl-4 text-sm font-medium hover:text-primary">\n              <ArrowLeft className="size-4" aria-hidden="true" />\n              All openings\n            </Link>\n          </div>',
  ],
]);
record(
  'careers detail header',
  fs.readFileSync(fe('src/pages/careers/CareersDetailPage.tsx'), 'utf8').includes('<Logo width={140} />'),
);

// ---------------------------------------------------------------------
//  3. Careers footer
// ---------------------------------------------------------------------
const year = new Date().getFullYear();
patch('src/pages/careers/CareersListPage.tsx', [
  [
    'HR ATS careers portal · Your data is handled per our privacy policy.',
    `© ${year} Business Gateways. Your personal data is handled in line with our privacy policy.`,
  ],
]);
record(
  'careers footer',
  fs.readFileSync(fe('src/pages/careers/CareersListPage.tsx'), 'utf8').includes('Business Gateways. Your personal data'),
);

// ---------------------------------------------------------------------
//  4. index.html — title, description, favicon
// ---------------------------------------------------------------------
{
  const file = 'index.html';
  patch(file, [
    ['<title>HR ATS</title>', '<title>Business Gateways — Careers &amp; Recruitment</title>'],
    [
      '<meta name="description" content="HR Job Requirement Board &amp; Applicant Tracking System" />',
      '<meta name="description" content="Business Gateways careers portal and recruitment platform — explore open positions and track your application." />',
    ],
  ]);

  let html = fs.readFileSync(fe(file), 'utf8');
  if (!html.includes('rel="icon"')) {
    html = html.replace(
      '    <title>',
      '    <link rel="icon" type="image/svg+xml" href="/bgi-logo.svg" />\n    <title>',
    );
    fs.writeFileSync(fe(file), html);
  }
  record('index.html branding', html.includes('Business Gateways') && html.includes('rel="icon"'));
}

// ---------------------------------------------------------------------
//  5. App name default
// ---------------------------------------------------------------------
for (const file of ['.env', '.env.example']) {
  const full = fe(file);
  if (!fs.existsSync(full)) continue;
  let text = fs.readFileSync(full, 'utf8');
  text = text.replace(/^VITE_APP_NAME=.*$/m, 'VITE_APP_NAME="Business Gateways"');
  fs.writeFileSync(full, text);
  record(`${file} app name`, text.includes('Business Gateways'));
}

// ---------------------------------------------------------------------
//  Report
// ---------------------------------------------------------------------
console.log('Branding applied:\n');
for (const { label, ok } of results) {
  console.log(`  ${ok ? 'OK  ' : 'MISS'}  ${label}`);
}

const missing = results.filter((r) => !r.ok);
if (missing.length > 0) {
  console.log(`\n${missing.length} edit(s) did not apply — the target text may have changed.`);
  process.exit(1);
}
