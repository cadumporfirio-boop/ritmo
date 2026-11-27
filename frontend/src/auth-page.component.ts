import {Component,inject,signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CloudStore} from './cloud.store';
@Component({selector:'auth-page',standalone:true,imports:[FormsModule],template:`
<main class="auth-page"><section class="auth-story"><a class="auth-brand" href="./" aria-label="Ritmo, início"><img src="icon.svg" width="38" height="38" alt="">ritmo</a><div class="auth-story-copy"><span class="auth-kicker">UM PASSO DE CADA VEZ</span><h1>Seu treino. <br>Seu tempo. <br>Seu ritmo.</h1><p>Planeje, registre e acompanhe sua evolução.</p></div><div class="auth-orbit" aria-hidden="true"><i></i><i></i><span></span></div><small>Menos planejamento. Mais movimento.</small></section>
<section class="auth-access"><div class="auth-card">
@if(cloud.initializing() || cloud.verifying() || cloud.accessChecking()){
 <div class="auth-loading" role="status"><span class="auth-spinner" aria-hidden="true"></span><h2>Preparando seu acesso</h2><p>Só um instante.</p></div>
}@else if(!cloud.configured()){
 <span class="auth-kicker">ENTRAR NO RITMO</span><h2>Vamos reconectar?</h2><p class="auth-intro">O acesso está indisponível agora. Seus dados salvos continuam preservados.</p><button class="primary auth-submit" (click)="cloud.retryAccess()">Tentar novamente</button>
}@else if(cloud.recovery() && cloud.verified()){
 <span class="auth-kicker">RECUPERAR ACESSO</span><h2>Escolha uma nova senha</h2><p class="auth-intro">Use pelo menos 8 caracteres.</p>
 <form class="auth-form" (ngSubmit)="updatePassword()"><label>Nova senha<div class="auth-password"><input aria-label="Nova senha da conta" [type]="visible()?'text':'password'" name="new-password" autocomplete="new-password" [(ngModel)]="password" required minlength="8" maxlength="200"><button type="button" [attr.aria-label]="visible()?'Ocultar senha':'Mostrar senha'" (click)="visible.set(!visible())">{{visible()?'Ocultar':'Mostrar'}}</button></div></label><label>Confirmar senha<input aria-label="Confirmar nova senha" type="password" name="confirmation" autocomplete="new-password" [(ngModel)]="confirmation" required minlength="8" maxlength="200"></label><button class="primary auth-submit" [disabled]="cloud.busy()">{{cloud.busy()?'Salvando…':'Salvar nova senha'}}</button></form>
}@else if(!cloud.verified()){
 <span class="auth-kicker">ENTRAR NO RITMO</span><h2>{{mode()==='signup'?'Comece por você.':mode()==='recover'?'Recupere seu acesso.':'Bom ter você aqui.'}}</h2><p class="auth-intro">{{mode()==='signup'?'Crie sua conta gratuita.':mode()==='recover'?'Enviaremos um link para o seu e-mail.':'Entre para continuar seu planejamento.'}}</p>
 @if(mode()!=='recover'){<div class="auth-tabs" aria-label="Acesso à conta"><button type="button" [class.selected]="mode()==='login'" [attr.aria-pressed]="mode()==='login'" (click)="changeMode('login')">Entrar</button><button type="button" [class.selected]="mode()==='signup'" [attr.aria-pressed]="mode()==='signup'" (click)="changeMode('signup')">Criar conta</button></div>}
 <form class="auth-form" (ngSubmit)="submit()"><label>E-mail<input aria-label="E-mail da conta" type="email" name="email" autocomplete="email" [(ngModel)]="email" required maxlength="254" placeholder="voce@exemplo.com"></label>
 @if(mode()!=='recover'){<label>Senha<div class="auth-password"><input aria-label="Senha da conta" [type]="visible()?'text':'password'" name="password" [autocomplete]="mode()==='signup'?'new-password':'current-password'" [(ngModel)]="password" required minlength="8" maxlength="200" [placeholder]="mode()==='signup'?'Pelo menos 8 caracteres':'Sua senha'"><button type="button" [attr.aria-label]="visible()?'Ocultar senha':'Mostrar senha'" (click)="visible.set(!visible())">{{visible()?'Ocultar':'Mostrar'}}</button></div></label>}
 @if(mode()==='signup'){<label>Confirmar senha<input aria-label="Confirmar senha" type="password" name="confirmation" autocomplete="new-password" [(ngModel)]="confirmation" required minlength="8" maxlength="200" placeholder="Repita sua senha"></label>}
 @if(mode()==='login'){<button type="button" class="text-button auth-forgot" (click)="changeMode('recover')">Esqueci a senha</button>}
 <button class="primary auth-submit" type="submit" [disabled]="cloud.busy()">{{cloud.busy()?'Aguarde…':mode()==='signup'?'Criar conta gratuita':mode()==='recover'?'Enviar link de recuperação':'Entrar na conta'}}<span aria-hidden="true">→</span></button></form>
 @if(mode()==='recover'){<button type="button" class="text-button auth-back" (click)="changeMode('login')">← Voltar para entrar</button>}
}@else{
 <span class="auth-kicker">CONTA PRONTA</span><h2>Seu espaço está pronto.</h2><p class="auth-intro">{{cloud.user()?.email}}</p>
 @if(cloud.cachedAccount()){<button class="primary auth-submit" [disabled]="cloud.busy()" (click)="cloud.openCached()">Continuar cópia local desta conta</button>}
 @if(cloud.remote()){<button class="primary auth-submit" [disabled]="cloud.busy()" (click)="cloud.openRemote()">Abrir dados da minha conta</button>}
 @else{<button class="primary auth-submit" [disabled]="cloud.busy()" (click)="cloud.startEmpty()">Começar no Ritmo <span>→</span></button>}
 @if(cloud.hasLocalData()){<div class="auth-migration"><strong>Já tem treinos neste navegador?</strong>@if(cloud.summary();as info){<p>{{info.workouts}} fichas · {{info.plans}} planejamentos · {{info.sessions}} sessões</p>}<button class="secondary" [disabled]="cloud.busy()" (click)="cloud.migrateLocal()">Salvar dados deste aparelho na conta</button><small>A cópia local permanece guardada.</small></div>}
 <button class="text-button auth-back" [disabled]="cloud.busy()" (click)="cloud.signOut()">Sair da conta</button>
}
@if(formError() || cloud.message()){<div class="auth-feedback" role="status">{{formError() || cloud.message()}}</div>}
@if(cloud.user() && !cloud.verified() && !cloud.initializing()){<button class="text-button auth-back" [disabled]="cloud.busy()||cloud.verifying()" (click)="cloud.retryAccess()">Verificar conexão novamente</button>}
@if(!cloud.initializing() && !cloud.verifying()){<p class="auth-footnote">Seus treinos acompanham você.</p>}
</div></section></main>
`})
export class AuthPage {
 readonly cloud=inject(CloudStore);readonly mode=signal<'login'|'signup'|'recover'>('login');readonly visible=signal(false);readonly formError=signal('');email='';password='';confirmation='';
 changeMode(mode:'login'|'signup'|'recover'){this.mode.set(mode);this.password='';this.confirmation='';this.visible.set(false);this.formError.set('');this.cloud.message.set('');}
 async submit(){this.formError.set('');if(this.mode()==='recover'){await this.cloud.resetPassword(this.email);return;}if(this.mode()==='signup'&&this.password!==this.confirmation){this.formError.set('As senhas precisam ser iguais.');return;}await this.cloud.authenticate(this.email,this.password,this.mode()==='signup');this.password='';this.confirmation='';}
 async updatePassword(){this.formError.set('');if(this.password!==this.confirmation){this.formError.set('As senhas precisam ser iguais.');return;}await this.cloud.changePassword(this.password);this.password='';this.confirmation='';}
}
