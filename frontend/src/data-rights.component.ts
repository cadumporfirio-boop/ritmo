import {Component,inject,signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {CloudStore} from './cloud.store';
@Component({selector:'data-rights',standalone:true,imports:[FormsModule],template:`
<section class="panel data-rights"><h2>Seus dados</h2>
@if(cloud.demo){<p class="builder-help">Esta demonstração usa somente o navegador. Para gerenciar sua conta, abra o Ritmo.</p>}
@else{
<div class="builder-actions"><button class="secondary" [disabled]="cloud.busy()" (click)="cloud.exportPersonalData()">Baixar dados da conta</button><button class="secondary" [disabled]="cloud.busy()" (click)="showRequests.set(!showRequests());showRequests()&&cloud.loadRequests()">{{showRequests()?'Fechar solicitações':'Solicitar acesso ou correção'}}</button></div>
@if(showRequests()){
<form class="rights-form" (ngSubmit)="send()"><label>O que você precisa?<select aria-label="Tipo de solicitação de dados" name="kind" [(ngModel)]="kind"><option value="access">Acesso aos dados</option><option value="correction">Corrigir informações</option><option value="information">Entender o uso dos dados</option><option value="deletion">Ajuda com exclusão</option></select></label><label>Descreva seu pedido<textarea aria-label="Pedido sobre seus dados" name="message" [(ngModel)]="message" minlength="10" maxlength="2000" required rows="3" placeholder="Não inclua senha, documentos ou informações clínicas."></textarea></label><button class="primary" [disabled]="cloud.busy()">Registrar solicitação</button></form>
<p class="builder-help">A resposta aparece aqui. Não enviamos e-mail automático. O perfil permite corrigir nome e preferências diretamente.</p>
<div class="rights-requests" aria-live="polite">@for(request of cloud.requests();track request.id){<article class="rights-request"><strong>{{request.status==='answered'?'Respondida':'Aguardando revisão'}}</strong><small>Protocolo {{request.id}} · {{date(request.created_at)}}</small><p>{{request.message}}</p>@if(request.response){<p><strong>Resposta:</strong> {{request.response}}</p>}</article>}@empty{<p class="builder-help">Nenhuma solicitação carregada.</p>}</div><button class="text-button" [disabled]="cloud.busy()" (click)="cloud.loadRequests()">Atualizar protocolos</button>
}
<details class="rights-explanation"><summary>Onde ficam as cópias?</summary><p>Os dados salvos ficam neste navegador e na sua conta no Supabase. Cópias anteriores também podem ficar neste aparelho.</p><p>Arquivos que você baixou, outros aparelhos e dados que colou em chats de IA não são apagados pelo Ritmo. Exclua essas cópias separadamente.</p><p>A exclusão remove o banco ativo. Backups e logs do provedor seguem os prazos e controles próprios; não prometemos apagamento instantâneo de todas as cópias. Solicite esclarecimentos acima.</p></details>
<details class="delete-account" (toggle)="clearPassword($event)"><summary>Excluir minha conta</summary><p>Remove o acesso, perfil, treinos, planejamentos e solicitações desta conta do banco ativo. Esta ação não pode ser desfeita pelo app.</p><p>Baixe seus dados antes, se quiser guardar uma cópia.</p><form class="rights-form" (ngSubmit)="remove()"><label>E-mail da conta<input aria-label="E-mail para excluir conta" type="email" name="delete-email" [(ngModel)]="email" autocomplete="email" required></label><label>Confirme sua senha<input aria-label="Senha para excluir conta" type="password" name="delete-password" [(ngModel)]="password" autocomplete="current-password" required maxlength="200"></label><label>Digite EXCLUIR<input aria-label="Confirmação de exclusão" name="confirmation" [(ngModel)]="confirmation" autocomplete="off" required></label><label class="checkbox-label"><input type="checkbox" name="guest" [(ngModel)]="removeGuest">Apagar também os dados antigos sem conta deste navegador</label><label class="checkbox-label"><input type="checkbox" name="acknowledgment" [(ngModel)]="acknowledged" required>Entendi que a exclusão é definitiva e que cópias externas precisam ser tratadas separadamente.</label><button class="danger-button" [disabled]="cloud.busy()||!acknowledged||confirmation!=='EXCLUIR'">Excluir definitivamente minha conta</button></form></details>
}
@if(cloud.message()){<p class="rights-feedback" role="status">{{cloud.message()}}</p>}
</section>
`})
export class DataRights {
 readonly cloud=inject(CloudStore);readonly showRequests=signal(false);kind='access';message='';email='';password='';confirmation='';removeGuest=false;acknowledged=false;
 date(value:string){return new Date(value).toLocaleDateString('pt-BR');}
 async send(){if(await this.cloud.sendPrivacyRequest(this.kind,this.message))this.message='';}
 async remove(){if(!this.acknowledged)return;try{await this.cloud.deleteAccount(this.password,this.email,this.confirmation,this.removeGuest);}finally{this.password='';}}
 clearPassword(event:Event){if(!(event.target as HTMLDetailsElement).open){this.password='';this.acknowledged=false;this.confirmation='';}}
}
