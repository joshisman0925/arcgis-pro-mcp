import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
const run = promisify(execFile);
const keys = ['APPDATA','COMSPEC','HOMEDRIVE','HOMEPATH','LOCALAPPDATA','PATH','PATHEXT','PROCESSOR_ARCHITECTURE','PROGRAMDATA','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMW6432','SYSTEMDRIVE','SYSTEMROOT','TEMP','USERNAME','USERPROFILE','WINDIR'];
const pick = k => Object.keys(process.env).find(e => e.toUpperCase() === k);
const minimal = Object.fromEntries(keys.map(k => [k, process.env[pick(k)]]).filter(([, v]) => v !== undefined));
const sys = process.env.SystemRoot + '\system32\WindowsPowerShell\v1.0\Modules';
const server = pathToFileURL(fileURLToPath(new URL('../server.mjs', import.meta.url))).href;
const inner = `const t=Date.now();try{const m=await import(${JSON.stringify(server)});const r=await m.listSessions();console.log('inner ok',Date.now()-t,'ms',JSON.stringify(r))}catch(e){console.log('inner ERR',Date.now()-t,'ms',e.message.slice(0,120))}`;
const steps = [
  ['sysOnly-first exit', { ...minimal, PSModulePath: sys }, 'exit 0'],
  ['sysOnly getprocess', { ...minimal, PSModulePath: sys }, 'Get-Process -Id $PID | Out-Null'],
  ['node-minimal listSessions #1', minimal, null],
  ['node-minimal listSessions #2', minimal, null],
  ['minimal exit', minimal, 'exit 0'],
  ['sysOnly exit again', { ...minimal, PSModulePath: sys }, 'exit 0'],
];
for (const [name, env, cmd] of steps) {
  const t = Date.now();
  try {
    const { stdout } = cmd ? await run('powershell.exe', ['-NoProfile','-NonInteractive','-Command', cmd], { env, windowsHide: true, timeout: 45000 })
      : await run(process.execPath, ['--input-type=module', '-e', inner], { env, windowsHide: true, timeout: 60000 });
    console.log(name, Date.now() - t, 'ms', stdout.trim());
  } catch (e) { console.log(name, Date.now() - t, 'ms ERROR', String(e.stderr).slice(0, 150)); }
}
