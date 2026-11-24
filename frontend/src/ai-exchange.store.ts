import {Injectable,signal} from '@angular/core';
import type {AiRequest} from './ai-exchange';
import type {Program} from './planning';
@Injectable({providedIn:'root'})
export class AiExchangeStore {
 readonly request=signal<AiRequest|null>(null);readonly prompt=signal('');readonly responseText=signal('');readonly preview=signal<Program|null>(null);readonly instructions=signal('');
}
