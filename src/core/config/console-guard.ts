/**
 * Silences console.log/debug/info/trace (warn/error stay). In deployed builds the Worker
 * injects the same guard into <head> before any script runs (worker/runtime-config.ts);
 * this function covers `next dev` and any page the Worker did not rewrite.
 */
export const CONSOLE_GUARD_SOURCE =
  "(function(){var n=function(){};['log','debug','info','trace'].forEach(function(m){try{console[m]=n}catch(e){}})})();";

export function applyConsoleGuard(enableLogs: boolean) {
  if (enableLogs || typeof window === 'undefined') return;
  for (const m of ['log', 'debug', 'info', 'trace'] as const) {
    try { console[m] = () => {}; } catch { /* read-only console */ }
  }
}
