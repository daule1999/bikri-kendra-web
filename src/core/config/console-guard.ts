import { RUNTIME_FLAGS } from './runtime-flags';

/**
 * Inline script for <head> (runs before any bundle). When NEXT_PUBLIC_ENABLE_LOGS=false
 * it silences console.log/debug/info/trace; warn and error are kept for real faults.
 */
export const CONSOLE_GUARD_SCRIPT = RUNTIME_FLAGS.enableLogs
  ? ''
  : "(function(){var n=function(){};['log','debug','info','trace'].forEach(function(m){try{console[m]=n}catch(e){}})})();";
