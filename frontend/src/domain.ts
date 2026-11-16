export interface Series { kg: number | null; reps: number | null; rir: number | null; done: boolean }
export interface Exercise { id: string; name: string; detail: string; target: string; previous: string; sets: Series[]; metrics?: { key: string; loadBasis: string; setType: string; repMin: number; repMax: number } }
export interface Session { id: string; date: string; name: string; minutes: number; exercises: Exercise[]; note: string; completed: boolean }
export interface Activity { day: string; name: string; time: string; type: 'strength' | 'sport' | 'cardio' | 'rest'; minutes: number }
export interface Profile { name: string; goal: string; experience: string; equipment: string; autonomy: boolean }
export interface State { version: 1; profile: Profile; week: Activity[]; sessions: Session[]; active: Session | null }
export const initialWeek: Activity[] = [
  {day:'Seg',name:'Superiores completo',time:'19:00',type:'strength',minutes:60},
  {day:'Ter',name:'Basquete',time:'19:00',type:'sport',minutes:60},
  {day:'Qua',name:'Inferiores',time:'19:00',type:'strength',minutes:55},
  {day:'Qui',name:'Descanso e estudo',time:'18:00',type:'rest',minutes:0},
  {day:'Sex',name:'Superiores',time:'18:00',type:'strength',minutes:60},
  {day:'Sáb',name:'Cardio',time:'09:00',type:'cardio',minutes:30},
  {day:'Dom',name:'Descanso',time:'',type:'rest',minutes:0}
];
export function initialState(): State { return {version:1,profile:{name:'',goal:'Reduzir gordura',experience:'Intermediário',equipment:'Academia completa',autonomy:true},week:structuredClone(initialWeek),sessions:[],active:null}; }
export function createSession(activity: Activity, minutes: number): Session {
  const lower = activity.name.toLowerCase().includes('inferiores');
  const names = lower ? ['Agachamento livre','Leg press','Mesa flexora','Elevação de panturrilha'] : ['Supino reto com halteres','Remada baixa','Desenvolvimento com halteres','Puxada frontal','Rosca direta','Tríceps na polia'];
  const count = minutes <= 30 ? 3 : names.length;
  return {id:crypto.randomUUID(),date:new Date().toISOString(),name:activity.name,minutes,note:'',completed:false,exercises:activity.type==='strength'?names.slice(0,count).map((name,i)=>({id:crypto.randomUUID(),name,metrics:{key:'demo-v1:'+name,loadBasis:'Carga informada no mesmo equipamento',setType:'Série de trabalho',repMin:8,repMax:12},detail:i===0?'Principal · descanso 90 s':'Complementar · descanso 60–90 s',target:'3 séries · 8–12 repetições',previous:'Sem registro anterior',sets:Array.from({length:3},()=>({kg:null,reps:null,rir:null,done:false}))})):[]};
}
export function validSet(set: Series): boolean { return set.kg !== null && Number.isFinite(set.kg) && set.kg >= 0 && set.kg <= 1000 && set.reps !== null && Number.isInteger(set.reps) && set.reps > 0 && set.reps <= 200 && (set.rir===null || (Number.isInteger(set.rir) && set.rir>=0 && set.rir<=10)); }
export function summarize(session: Session) {
  const sets = session.exercises.flatMap(e=>e.sets);
  const confirmed = sets.filter(s=>s.done && validSet(s));
  return {confirmed:confirmed.length,total:sets.length,volume:confirmed.reduce((sum,s)=>sum+s.kg!*s.reps!,0),pending:sets.length-confirmed.length};
}
export function finishSession(session: Session): Session { return {...structuredClone(session),completed:true}; }
export function restore(raw: string | null): State {
  if (!raw) return initialState();
  const state = JSON.parse(raw) as State;
  if(state.version!==1 || !state.profile || typeof state.profile.name!=='string' || !Array.isArray(state.week) || state.week.length!==7 || !state.week.every(a=>typeof a.name==='string' && typeof a.time==='string' && ['strength','sport','cardio','rest'].includes(a.type)) || !Array.isArray(state.sessions)) throw Error('Formato de dados inválido');
  const sessions=[...state.sessions,...(state.active?[state.active]:[])];
  if(sessions.some(s=>!s || typeof s.id!=='string' || typeof s.name!=='string' || !Number.isFinite(Date.parse(s.date)) || typeof s.note!=='string' || !Array.isArray(s.exercises) || s.exercises.some(e=>typeof e.name!=='string' || !Array.isArray(e.sets) || e.sets.some(set=>typeof set.done!=='boolean' || (set.done&&!validSet(set)))))) throw Error('Histórico incompatível');
  return state;
}
