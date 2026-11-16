import { Component, input, computed } from '@angular/core';
import type { Session } from './domain';
import { analyzeSession } from './analytics';

@Component({selector:'app-session-analysis',standalone:true,template:`
  <section class="analysis-panel" aria-label="Análise automática da sessão">
    <div class="analysis-heading"><h3>Análise da sessão</h3><span>Regras fixas · sem IA</span></div>
    <div class="analysis-legend">Verde: meta / aumento · Âmbar: atenção · Azul: comparação · Cinza: contexto ou dados insuficientes</div>
    <div class="indicator-grid">@for(metric of report().indicators;track metric.label){<div class="indicator" [attr.data-tone]="metric.tone"><span>{{metric.label}}</span><strong>{{metric.value}}</strong><p>{{metric.message}}</p>@if(metric.percent!==undefined){<div class="metric-track" role="progressbar" [attr.aria-label]="metric.label" [attr.aria-valuenow]="metric.percent" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuetext]="metric.value+' — '+metric.message"><span [style.width.%]="metric.percent"></span></div>}</div>}</div>
    @for(exercise of report().exercises;track $index){<div class="exercise-analysis"><h4>{{exercise.name}}</h4><div class="indicator-grid">@for(metric of exercise.indicators;track metric.label){<div class="indicator" [attr.data-tone]="metric.tone"><span>{{metric.label}}</span><strong>{{metric.value}}</strong><p>{{metric.message}}</p>@if(metric.percent!==undefined){<div class="metric-track" role="progressbar" [attr.aria-label]="exercise.name+' — '+metric.label" [attr.aria-valuenow]="metric.percent" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuetext]="metric.value+' — '+metric.message"><span [style.width.%]="metric.percent"></span></div>}</div>}</div></div>}
    <p class="analysis-disclaimer">Mais volume ou séries não significa automaticamente um treino melhor. Compare também a meta e o contexto.</p>
  </section>
`})
export class AnalysisComponent {
  session=input.required<Session>();
  history=input.required<Session[]>();
  revision=input(0);
  report=computed(()=>{this.revision();return analyzeSession(this.session(),this.history());});
}
