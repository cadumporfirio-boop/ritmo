import {Component,ElementRef,effect,inject,input,viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CloudStore} from './cloud.store';
@Component({selector:'cloud-account',standalone:true,imports:[FormsModule],template:`
<dialog #dialog class="account-dialog" aria-labelledby="account-title" (cancel)="cancel($event)"><div class="account-header"><div><p class="eyebrow">SEUS DADOS, NO SEU RITMO</p><h2 id="account-title">Minha conta</h2></div>@if(!cloud.locked()){<button class="icon-button" aria-label="Fechar conta" (click)="cloud.panel.set(false)">×</button>}</div>
@if(cloud.message()){<div class="notice account-feedback" role="status">{{cloud.message()}}<button aria-label="Fechar mensagem da conta" (click)="cloud.message.set('')">×</button></div>}
@if(cloud.initializing()){<p class="muted">Conferindo conexão…</p>}
@else if(cloud.demo){<p class="account-intro">Para usar sua conta, abra o Ritmo em uma janela própria.</p><a class="secondary" href="https://cadumporfirio-boop.github.io/ritmo/" target="_blank" rel="noopener">Abrir Ritmo</a>}
@else if(cloud.connected()){
<p class="account-email">{{cloud.user()?.email}}</p>
@if(cloud.connected()){
<div class="account-sync-state"><span class="account-sync-dot" [class.pending]="cloud.status()!=='synced'"></span><strong>{{cloud.label()}}</strong></div>
@if(cloud.status()==='conflict'){<p class="notice">Este aparelho e a conta têm alterações diferentes. Nada foi substituído. Baixe uma cópia deste aparelho antes de escolher a versão online.</p><button class="secondary" (click)="cloud.exportBackup()">Baixar cópia deste aparelho</button><label class="account-confirm"><input type="checkbox" [(ngModel)]="replaceConfirmed"> Quero abrir a versão online. A cópia atual ficará guardada neste aparelho.</label>}
@if(cloud.status()==='download'||cloud.status()==='conflict'){<button class="primary" [disabled]="cloud.busy()||editing()||ongoing()||(cloud.status()==='conflict'&&!replaceConfirmed)" (click)="cloud.openRemote()">Aplicar versão da conta e reabrir</button>}
<button class="secondary" [disabled]="cloud.busy()" (click)="cloud.sync()">Sincronizar agora</button>
<p class="builder-help">Sem conexão, salvamos neste aparelho. O envio retoma quando a internet voltar.</p>
}
@if(editing()||ongoing()){<p class="builder-help">Salve a edição e finalize a sessão antes de aplicar dados online.</p>}
<div class="account-links"><button class="text-button" (click)="cloud.exportBackup()">Baixar backup completo</button><button class="text-button" [disabled]="cloud.busy()||editing()" (click)="cloud.signOut()">Sair da conta</button></div>
}
</dialog>
`})
export class CloudAccount {
 private returnFocus:HTMLElement|null=null;readonly cloud=inject(CloudStore);readonly editing=input(false);readonly ongoing=input(false);readonly dialog=viewChild<ElementRef<HTMLDialogElement>>('dialog');replaceConfirmed=false;
 constructor(){effect(()=>{const element=this.dialog()?.nativeElement;if(!element)return;const open=this.cloud.panel();if(open&&!element.open){this.returnFocus=document.activeElement as HTMLElement;if(element.showModal)element.showModal();else element.setAttribute('open','');}else if(!open&&element.open){if(element.close)element.close();else element.removeAttribute('open');this.returnFocus?.focus();}});}
 cancel(event:Event){if(this.cloud.locked())event.preventDefault();else this.cloud.panel.set(false);}
}
