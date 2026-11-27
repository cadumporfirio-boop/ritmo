/** Compiled separately: the public portfolio demo never shares account storage. */
declare const RITMO_DEMO:boolean;
export const DEMO_MODE=typeof RITMO_DEMO!=='undefined'&&RITMO_DEMO;
