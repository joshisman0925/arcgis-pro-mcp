import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const keys = ['APPDATA','COMSPEC','HOMEDRIVE','HOMEPATH','LOCALAPPDATA','PATH','PATHEXT','PROCESSOR_ARCHITECTURE','PROGRAMDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMW6432','SYSTEMDRIVE','SYSTEMROOT','TEMP','USERNAME','USERPROFILE','WINDIR'];
const pick = k => Object.keys(process.env).find(e => e.toUpperCase() === k);
const minimal = Object.fromEntries(keys.map(k => [k, process.env[pick(k)]]).filter(([, v]) => v !== undefined));
console.log('runner PSModulePath =', process.env.PSModulePath);
const sys = process.env.SystemRoot + '\system32\WindowsPowerShell\v1.0\Modules';
const missing = Object.keys(process.env).filter(k => !keys.includes(k.toUpperCase()));
console.log('dropped vars =', missing.join(','));
const cmds = { exit: 'exit 0', getprocess: 'Get-Process -Id $PID | Out-Null', convert: '1 | ConvertTo-Json | Out-Null' };
const envs = { minimal, sysOnly: { ...minimal, PSModulePath: sys }, runnerPath: { ...minimal, PSModulePath: process.env.PSModulePath },
  plusAll: { ...process.env, PSModulePath: undefined } };
delete envs.plusAll.PSModulePath;
for (const [en, env] of Object.entries(envs)) for (const [cn, cmd] of Object.entries(cmds)) {
  const t = Date.now();
  try { await run('powershell.exe', ['-NoProfile','-NonInteractive','-Command', cmd], { env, windowsHide: true, timeout: 45000 }); console.log(en, cn, Date.now() - t, 'ms'); }
  catch (e) { console.log(en, cn, Date.now() - t, 'ms ERROR', String(e.stderr).slice(0, 150)); }
}
