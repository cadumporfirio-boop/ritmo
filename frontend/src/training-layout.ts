import {expand} from './training.ts';
import type {Workout,ExpandedStep} from './training.ts';
export function executionGroups(plan:Workout){
 const groups:{key:string;items:{item:ExpandedStep;index:number}[]}[]=[];
 for(const [index,item] of expand(plan).entries()){
  const previous=groups.at(-1);
  if(previous?.items.at(-1)?.item.step.id===item.step.id)previous.items.push({item,index});
  else groups.push({key:item.key,items:[{item,index}]});
 }
 return groups;
}
