import {Component,ElementRef,effect,inject,input,viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CloudStore} from './cloud.store';
@Component({selector:'cloud-account',standalone:true,imports:[FormsModule],template:`
<dialog #dialog class="account-dialog" (cancel)="cancel($event)"><div class="account-header"><div><p class="eyebrow">SEUS DADOS, NO SEU RITMO</p><h2>Minha conta</h2></div>@if(!cloud.locked()){<button class="icon-button" aria-label="Fechar conta" (click)="cloud.panel.set(false)">×</button>}</div>
@if(cloud.message()){<p class="notice" role="status">{{cloud.message()}}</p>}
@if(cloud.initializing()){<p class="muted">Conferindo conexão…</p>}
@else if(cloud.embedded){<p class="account-intro">Para usar sua conta, abra o Ritmo em uma janela própria.</p><a class="secondary" href="https://cadumporfirio-boop.github.io/ritmo/" target="_blank" rel="noopener">Abrir Ritmo</a>}
@else if(!cloud.configured()){<p class="account-intro">A conexão com o Supabase está sendo preparada. Por enquanto, os dados continuam neste navegador.</p><button class="secondary" (click)="cloud.exportBackup()">Baixar backup completo</button>@if(cloud.locked()){<button class="secondary" (click)="cloud.returnToGuest()">Usar sem conta</button>}}
@else if(!cloud.user()||cloud.locked()){
<p class="account-intro">Entre para guardar seus treinos na conta e acessar em outro aparelho.</p>
<form (ngSubmit)="authenticate()"><label>E-mail<input aria-label="E-mail da conta" type="email" name="email" autocomplete="email" [(ngModel)]="email" required maxlength="254"></label><label>{{cloud.recovery()?'Nova senha':'Senha'}}<input aria-label="Senha da conta" type="password" name="password" [autocomplete]="signup?'new-password':'current-password'" [(ngModel)]="password" required minlength="8" maxlength="200"></label><button class="primary" type="submit" [disabled]="cloud.busy()">{{cloud.busy()?'Aguarde…':signup?'Criar conta gratuita':'Entrar na conta'}}</button></form>
<div class="account-links"><button class="text-button" [disabled]="cloud.busy()" (click)="signup=!signup">{{signup?'Já tenho uma conta':'Criar minha conta'}}</button><button class="text-button" [disabled]="cloud.busy()||!email" (click)="cloud.resetPassword(email)">Esqueci a senha</button></div>
@if(cloud.locked()){<p class="builder-help">Entre na conta usada neste aparelho ou volte aos dados sem login.</p><button class="secondary" (click)="cloud.returnToGuest()">Usar sem conta neste aparelho</button>}
}@else if(cloud.recovery()){
<label>Nova senha<input aria-label="Nova senha da conta" type="password" autocomplete="new-password" [(ngModel)]="password" minlength="8"></label><button class="primary" [disabled]="cloud.busy()" (click)="changePassword()">Salvar nova senha</button>
}@else{
<p class="account-email">{{cloud.user()?.email}}</p>
@if(cloud.connected()){
<div class="account-sync-state"><span class="account-sync-dot" [class.pending]="cloud.status()!=='synced'"></span><strong>{{cloud.label()}}</strong></div>
@if(cloud.status()==='conflict'){<p class="notice">Este aparelho e a conta têm alterações diferentes. Nada foi substituído. Baixe uma cópia deste aparelho antes de escolher a versão online.</p><button class="secondary" (click)="cloud.exportBackup()">Baixar cópia deste aparelho</button><label class="account-confirm"><input type="checkbox" [(ngModel)]="replaceConfirmed"> Quero abrir a versão online. A cópia atual ficará guardada neste aparelho.</label>}
@if(cloud.status()==='download'||cloud.status()==='conflict'){<button class="primary" [disabled]="cloud.busy()||editing()||ongoing()||(cloud.status()==='conflict'&&!replaceConfirmed)" (click)="cloud.openRemote()">Aplicar versão da conta e reabrir</button>}
<button class="secondary" [disabled]="cloud.busy()" (click)="cloud.sync()">Sincronizar agora</button>
<p class="builder-help">Sem internet, os registros ficam neste aparelho. O envio é retomado quando a conexão voltar. A tela avisa quando há uma versão nova para abrir.</p>
}@else{
<p class="account-intro">Como você quer começar?</p>@if(cloud.cachedAccount()){<div class="account-choice"><strong>Continuar neste aparelho</strong><p>Abra os dados já salvos desta conta, incluindo alterações ainda não enviadas.</p><button class="secondary" [disabled]="cloud.busy()||editing()" (click)="cloud.openCached()">Continuar cópia local desta conta</button></div>}@if(cloud.summary();as summary){<p class="account-summary">Neste aparelho: {{summary.workouts}} fichas · {{summary.plans}} planejamentos · {{summary.sessions}} sessões</p>}
<div class="account-choice"><strong>Continuar com meus dados</strong><p>Salvar uma cópia na conta. Os dados sem login permanecem guardados separadamente.</p><button class="primary" [disabled]="cloud.busy()||editing()" (click)="cloud.migrateLocal()">Salvar dados deste aparelho na conta</button></div>
<div class="account-choice"><strong>Já uso em outro aparelho</strong><p>Abrir a versão da conta. Os dados deste navegador não serão apagados.</p><button class="secondary" [disabled]="cloud.busy()||editing()" (click)="cloud.openRemote()">Abrir dados da minha conta</button></div>
}
@if(editing()||ongoing()){<p class="builder-help">Salve sua edição antes de trocar os dados. Para aplicar uma versão online, finalize a sessão em andamento.</p>}
<div class="account-links"><button class="text-button" (click)="cloud.exportBackup()">Baixar backup completo</button><button class="text-button" [disabled]="cloud.busy()||editing()" (click)="cloud.signOut()">Sair da conta</button></div>
}
</dialog>
`})
export class CloudAccount {
 readonly cloud=inject(CloudStore);readonly editing=input(false);readonly ongoing=input(false);readonly dialog=viewChild<ElementRef<HTMLDialogElement>>('dialog');email='';password='';signup=false;replaceConfirmed=false;
 constructor(){effect(()=>{const element=this.dialog()?.nativeElement;if(!element)return;const open=this.cloud.panel()||this.cloud.locked();if(open&&!element.open){if(element.showModal)element.showModal();else element.setAttribute('open','');}else if(!open&&element.open){if(element.close)element.close();else element.removeAttribute('open');}});}
 cancel(event:Event){if(this.cloud.locked())event.preventDefault();else this.cloud.panel.set(false);}
 async authenticate(){await this.cloud.authenticate(this.email,this.password,this.signup);this.password='';}
 async changePassword(){await this.cloud.changePassword(this.password);this.password='';}
}
