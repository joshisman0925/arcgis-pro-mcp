import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { toolNames } from '../tools.mjs';

// Submission guard: keep the manifest within the OpenAI plugin directory field limits and keep the
// reviewer test cases in the documented shape, pointing only at tools this server registers.
// Source: https://developers.openai.com/plugins/deploy/submission (checked 2026-10-30).
const LIMITS = { name: 64, description: 4000, displayName: 30, shortDescription: 30, longDescription: 4000, developerName: 80 };
const URL_FIELDS = ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL'];

export function manifestProblems(manifest) {
  const problems = [];
  const ui = manifest?.extensions?.['com.openai']?.interface ?? {};
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(manifest?.name ?? '')) problems.push(`name ${manifest?.name} is not kebab-case`);
  for (const [field, max] of Object.entries(LIMITS)) {
    const value = field in ui ? ui[field] : manifest?.[field];
    if (typeof value !== 'string' || !value.trim()) problems.push(`${field} missing`);
    else if (value.length > max) problems.push(`${field} ${value.length} > ${max} chars`);
  }
  for (const field of URL_FIELDS) {
    let url;
    try { url = new URL(ui[field]); } catch { problems.push(`${field} missing or invalid`); continue; }
    if (url.protocol !== 'https:' || url.username || url.password || ui[field].length > 1024) problems.push(`${field} must be HTTPS without credentials`);
  }
  for (const field of ['logo', 'composerIcon']) if (!/^\.\/\S+\.(png|jpe?g|webp|svg)$/i.test(ui[field] ?? '')) problems.push(`${field} must be a ./ PNG, JPEG, WebP or SVG path`);
  const prompts = ui.defaultPrompt ?? [];
  if (prompts.length > 3) problems.push(`defaultPrompt has ${prompts.length} > 3 entries`);
  for (const p of prompts) if (typeof p !== 'string' || p.length > 128) problems.push(`defaultPrompt entry over 128 chars: ${p}`);
  if (manifest?.extensions?.['com.openai']?.hooks) problems.push('lifecycle hooks are not eligible for the public directory');
  return problems;
}

export function testCaseProblems(cases, names = toolNames) {
  const problems = [];
  const positive = cases?.positive ?? [], negative = cases?.negative ?? [];
  if (positive.length !== 5) problems.push(`expected 5 positive cases, got ${positive.length}`);
  if (negative.length !== 3) problems.push(`expected 3 negative cases, got ${negative.length}`);
  const text = v => typeof v === 'string' && v.trim();
  positive.forEach((c, i) => {
    for (const f of ['description', 'prompt', 'tools_triggered', 'expected_behavior']) if (!text(c?.[f])) problems.push(`positive[${i}].${f} missing`);
    for (const tool of String(c?.tools_triggered ?? '').split(',').map(s => s.trim()).filter(Boolean)) if (!names.includes(tool)) problems.push(`positive[${i}] unknown tool ${tool}`);
  });
  negative.forEach((c, i) => {
    for (const f of ['description', 'prompt']) if (!text(c?.[f])) problems.push(`negative[${i}].${f} missing`);
  });
  for (const c of [...positive, ...negative]) for (const f of ['test_credentials', 'reviewer_instructions']) if (c && f in c) problems.push(`${f} must be entered in the portal, not packaged`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const read = async p => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
  const problems = [
    ...manifestProblems(await read('../plugin-template/plugin.json')).map(p => 'plugin.json: ' + p),
    ...testCaseProblems(await read('../docs/submission/review-test-cases.json')).map(p => 'review-test-cases.json: ' + p),
  ];
  if (problems.length) {
    console.error(`submission check: ${problems.length} problem(s)\n` + problems.map(p => '  - ' + p).join('\n'));
    process.exit(1);
  }
  console.log('submission check: manifest limits and 5 positive / 3 negative review cases OK');
}
