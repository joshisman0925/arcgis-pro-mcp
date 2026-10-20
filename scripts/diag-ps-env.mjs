import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
const run = promisify(execFile);
const keys = ['APPDATA','COMSPEC','HOMEDRIVE','HOMEPATH','LOCALAPPDATA','PATH','PATHEXT','PROCESSOR_ARCHITECTURE','PROGRAMDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMW6432','SYSTEMDRIVE','SYSTEMROOT','TEMP','USERNAME','USERPROFILE','WINDIR'];
const pick = k => Object.keys(process.env).find(e => e.toUpperCase() === k);
const minimal = Object.fromEntries(keys.map(k => [k, process.env[pick(k)]]).filter(([, v]) => v !== undefined));
const server = pathToFileURL(fileURLToPath(new URL('../server.mjs', import.meta.url))).href;
const cmds = {
  exit: 'exit 0',
  encoding: '[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)',
  getprocessName: 'Get-Process -Name ArcGISPro -ErrorAction SilentlyContinue | Out-Null',
  select: '@(1) | Select-Object @{Name="a";Expression={$_}} | Out-Null',
  convert: 'ConvertTo-Json -InputObject @() -Compress | Out-Null',
  traceModules: '$t=[Diagnostics.Stopwatch]::StartNew(); $null = Get-Command ConvertTo-Json; "getcmd=$($t.ElapsedMilliseconds)"; $env:PSModulePath; (Get-Module).Name -join ","',
};
const inner = `import { execFile } from 'node:child_process'; import { promisify } from 'node:util';
const run = promisify(execFile); const m = await import(${JSON.stringify(server)});
for (const [n, c] of Object.entries(${JSON.stringify(cmds)})) { const t = Date.now();
  try { const { stdout } = await run('powershell.exe', ['-NoProfile','-NonInteractive','-Command', c], { env: m.powershellEnv(process.env), windowsHide: true, timeout: 45000, encoding: 'utf8' }); console.log('inner', n, Date.now()-t, 'ms', stdout.trim().replace(/\r?\n/g,' | ').slice(0,300)); }
  catch (e) { console.log('inner', n, Date.now()-t, 'ms ERR', String(e.stderr).slice(0,150)); } }`;
const { stdout } = await run(process.execPath, ['--input-type=module', '-e', inner], { env: minimal, windowsHide: true, timeout: 400000 });
console.log(stdout);
