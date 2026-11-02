import { coverInk } from "./model";
export interface CoverItem {x:number;y:number;size:number;color:string;width:number}
export interface CoverLayout {title:CoverItem;description:CoverItem;icon:CoverItem}
export function coverLayout(value:Partial<CoverLayout>|undefined,color:string):CoverLayout{
 const ink=coverInk(color),defaults:CoverLayout={title:{x:65,y:330,size:36,color:ink,width:390},description:{x:65,y:495,size:16,color:ink,width:390},icon:{x:230,y:225,size:60,color:ink,width:60}};
 for(const key of ["title","description","icon"] as const){const item=value?.[key],base=defaults[key];if(!item)continue;const finite=(n:number|undefined,min:number,max:number,fallback:number)=>Number.isFinite(n)?Math.max(min,Math.min(max,n!)):fallback;defaults[key]={x:finite(item.x,0,500,base.x),y:finite(item.y,0,700,base.y),size:finite(item.size,key==="icon"?12:8,key==="icon"?180:100,base.size),width:finite(item.width,40,520,base.width),color:/^#[0-9a-f]{6}$/i.test(item.color)?item.color:ink};}
 return defaults;
}
