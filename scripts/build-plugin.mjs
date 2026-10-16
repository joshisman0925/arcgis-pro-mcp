import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('..', import.meta.url));
const target = path.join(root, 'plugins', 'arcgis-pro-mcp');
await mkdir(target, { recursive: true });
await cp(path.join(root, 'plugin-template'), target, { recursive: true });
await mkdir(path.join(target, 'server'), { recursive: true });
await mkdir(path.join(target, 'native'), { recursive: true });
await build({
  entryPoints: [path.join(root, 'server.mjs')], outfile: path.join(target, 'server/server.bundle.mjs'),
  platform: 'node', target: 'node20', format: 'esm', bundle: true, legalComments: 'external',
  banner: { js: "import { createRequire as __bundleCreateRequire } from 'node:module'; const require = __bundleCreateRequire(import.meta.url);" },
});
const addin = await readFile(path.join(root, 'LocalProConnector.esriAddinX'));
await writeFile(path.join(target, 'native/LocalProConnector.esriAddinX'), addin);
await writeFile(path.join(target, 'native/checksums.json'), JSON.stringify({ version: '0.3.1', proBaseline: '3.3', sha256: createHash('sha256').update(addin).digest('hex').toUpperCase() }, null, 2) + '\n');
const portable = JSON.parse(await readFile(path.join(target, 'plugin.json'), 'utf8'));
const legacy = { name: portable.name, version: portable.version, description: portable.description, author: portable.author,
  homepage: portable.homepage, repository: portable.repository, license: portable.license,
  skills: './skills/', mcpServers: './.mcp.json', requires_local_executor: true, interface: portable.extensions['com.openai'].interface,
  extensions: { 'com.openai': { onboardingSkill: './skills/setup/SKILL.md' } } };
await mkdir(path.join(target, '.codex-plugin'), { recursive: true });
await writeFile(path.join(target, '.codex-plugin/plugin.json'), JSON.stringify(legacy, null, 2) + '\n');
const mcp = JSON.parse(await readFile(path.join(target, 'mcp.json'), 'utf8'));
await writeFile(path.join(target, '.mcp.json'), JSON.stringify({ mcpServers: mcp.mcpServers }, null, 2) + '\n');
for (const file of ['LICENSE', 'PRIVACY.md', 'SECURITY.md', 'TOOLS.md', 'COMPATIBILITY.md', 'INSTALL-PROMPT.md', 'UPDATE-PROMPT.md']) await cp(path.join(root, file), path.join(target, file));
await mkdir(path.join(target, 'licenses'), { recursive: true });
for (const [pkg, name] of [['@modelcontextprotocol/core', 'mcp-core'], ['@modelcontextprotocol/server', 'mcp-server'], ['zod', 'zod']]) {
  await cp(path.join(root, 'node_modules', pkg, 'LICENSE'), path.join(target, 'licenses', name + '-LICENSE.txt'));
}
await writeFile(path.join(target, 'THIRD-PARTY-NOTICES.md'), '# Third-party software\n\nBundled MCP SDK 2.3.1: Apache-2.0 (licenses/mcp-core-LICENSE.txt and licenses/mcp-server-LICENSE.txt). Zod 4.6.7: MIT (licenses/zod-LICENSE.txt).\n\nThe MCP SDK contains content-type, Copyright(c) 2015 Douglas Christopher Wilson, MIT licensed. The MIT permission and warranty terms in licenses/zod-LICENSE.txt also apply to that component, with its own copyright attribution above. See server/server.bundle.mjs.LEGAL.txt for preserved bundled notices.\n\nThe native Add-in contains this project code only; ArcGIS Pro and Esri SDK assemblies are not redistributed.\n');
await writeFile(path.join(target, 'README.md'), '# ArcGIS Pro MCP Plugin\n\nWindows desktop-only plugin with 38 GIS tools. Requires licensed Pro 3.3 or a later 3.x and Node.js 20+. Dependencies are bundled; no npm install is required.\n\nRead SECURITY.md before use: results may reach the AI provider; the local pipe trusts the same Windows account. Confirmation parameters are not human authorization.\n\nRun the setup skill to check the Pro version and install the included Add-in while Pro is closed. Normally open Pro, then use list_sessions, ping and get_map. For existing installations, follow UPDATE-PROMPT.md. Installation and upgrade share scripts/install-addin.ps1; use -CheckOnly first. See INSTALL-PROMPT.md, COMPATIBILITY.md and TOOLS.md.\n\nPublic repository distribution is separate from OpenAI public-directory approval. This plugin is not an Esri product.\n\n## Privacy Policy\n\nSee PRIVACY.md. Tool results go to the requesting AI client and may be processed by its model provider. No maintainer telemetry or hosted backend is used.\n');
console.log(`Built ${target}`);
