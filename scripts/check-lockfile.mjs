import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Supply-chain guard: every locked package must come from the public npm registry over HTTPS
// with a sha512 integrity hash, so npm ci cannot silently pull from git, tarball URLs or plain HTTP.
const REGISTRY = 'https://registry.npmjs.org/';

export function lockfileProblems(lock) {
  const problems = [];
  if (!(lock?.lockfileVersion >= 2)) problems.push(`lockfileVersion ${lock?.lockfileVersion} < 2`);
  for (const [key, entry] of Object.entries(lock?.packages ?? {})) {
    if (key === '' || entry.link) continue;
    if (!key.startsWith('node_modules/') && !key.includes('/node_modules/')) { problems.push(`${key}: not a registry package path`); continue; }
    if (typeof entry.resolved !== 'string' || !entry.resolved.startsWith(REGISTRY)) problems.push(`${key}: resolved ${entry.resolved ?? '(missing)'}`);
    if (typeof entry.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]+=*$/.test(entry.integrity)) problems.push(`${key}: integrity ${entry.integrity ?? '(missing)'}`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const problems = lockfileProblems(lock);
  const count = Object.keys(lock.packages ?? {}).length - 1;
  if (problems.length) {
    console.error(`package-lock.json: ${problems.length} problem(s)\n` + problems.map(p => '  - ' + p).join('\n'));
    process.exit(1);
  }
  console.log(`package-lock.json: ${count} packages locked to ${REGISTRY} with sha512 integrity`);
}
