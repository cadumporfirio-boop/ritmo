import {expand,sessionExpansion} from './training.ts';
import type {Workout,ExpandedStep,TrainingSession} from './training.ts';
export function executionGroups(plan:Workout,session?:TrainingSession){
 const groups:{key:string;items:{item:ExpandedStep;index:number}[]}[]=[];
 for(const [index,item] of expand(plan).entries()){
  const previous=groups.at(-1);
  if(previous && (item.occurrence?previous.items.at(-1)?.item.occurrence===item.occurrence:previous.items.at(-1)?.item.step.id===item.step.id))previous.items.push({item,index:session?session.entries.findIndex(entry=>entry.key===item.key):index});
  else groups.push({key:item.key,items:[{item,index:session?session.entries.findIndex(entry=>entry.key===item.key):index}]});
 }
 if(session){const all=sessionExpansion(session);for(const [index,entry] of session.entries.entries()){if(!entry.extra)continue;const target=groups.find(group=>group.items.some(row=>row.item.key===entry.extra!.afterKey));if(target)target.items.push({item:all[index],index});}}
 return groups;
}
