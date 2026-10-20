import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const keys = ['APPDATA','COMSPEC','HOMEDRIVE','HOMEPATH','LOCALAPPDATA','PATH','PATHEXT','PROCESSOR_ARCHITECTURE','PROGRAMDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMW6432','SYSTEMDRIVE','SYSTEMROOT','TEMP','USERNAME','USERPROFILE','WINDIR'];
const pick = k => Object.keys(process.env).find(e => e.toUpperCase() === k);
const minimal = Object.fromEntries(keys.map(k => [k, process.env[pick(k)]]).filter(([, v]) => v !== undefined));
const cmd = "$ErrorActionPreference='Stop'; [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); $items = @(Get-Process -Name ArcGISPro -ErrorAction SilentlyContinue | Select-Object @{Name='processId';Expression={$_.Id}},@{Name='title';Expression={$_.MainWindowTitle}}); ConvertTo-Json -InputObject $items -Compress";
const variants = { 'minimal-first': minimal,  full: process.env, minimal, 'minimal+PSModulePath': { ...minimal, PSModulePath: process.env.PSModulePath }, 'minimal+TMP': { ...minimal, TMP: minimal.TEMP } };
for (const [name, env] of Object.entries(variants)) {
  const t = Date.now();
  try { await run('powershell.exe', ['-NoProfile','-NonInteractive','-Command', cmd], { env, windowsHide: true, timeout: 60000, encoding: 'utf8' }); console.log(name, Date.now() - t, 'ms'); }
  catch (e) { console.log(name, Date.now() - t, 'ms ERROR', e.killed, String(e.stderr).slice(0, 200)); }
}
