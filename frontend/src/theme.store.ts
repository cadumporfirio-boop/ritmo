import {DestroyRef,Injectable,inject,signal} from '@angular/core';
import {DEMO_MODE} from './app-mode';
export type ThemePreference='system'|'light'|'dark';
@Injectable({providedIn:'root'})
export class ThemeStore {
 readonly preference=signal<ThemePreference>('system');
 private key=DEMO_MODE?'ritmo.demo.theme.v1':'ritmo.theme.v1';
 private media=window.matchMedia?.('(prefers-color-scheme: dark)');
 constructor(){try{const saved=localStorage.getItem(this.key);if(saved==='dark'||saved==='light')this.preference.set(saved);}catch{}this.apply();const change=()=>this.apply();this.media?.addEventListener?.('change',change);const storage=(event:StorageEvent)=>{if(event.key===this.key){this.preference.set(event.newValue==='dark'||event.newValue==='light'?event.newValue:'system');this.apply();}};window.addEventListener('storage',storage);inject(DestroyRef).onDestroy(()=>{this.media?.removeEventListener?.('change',change);window.removeEventListener('storage',storage);});}
 set(value:string){if(!['system','light','dark'].includes(value))return;this.preference.set(value as ThemePreference);try{localStorage.setItem(this.key,value);}catch{}this.apply();}
 private apply(){const dark=this.preference()==='dark'||this.preference()==='system'&&!!this.media?.matches;document.documentElement.dataset['theme']=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';}
}
