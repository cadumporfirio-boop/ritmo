import {Component,inject} from '@angular/core';
import {ThemeStore} from './theme.store';
@Component({selector:'theme-picker',standalone:true,template:`<label class="theme-picker">Aparência<select aria-label="Aparência do Ritmo" [value]="theme.preference()" (change)="theme.set($any($event.target).value)"><option value="system">Do aparelho</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label>`})
export class ThemePicker {readonly theme=inject(ThemeStore);}
