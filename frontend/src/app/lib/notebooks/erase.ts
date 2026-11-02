import {uid,type Element,type Point,type Stroke} from "./model";
const bounds=new WeakMap<Stroke,{minX:number;maxX:number;minY:number;maxY:number}>();
function distance(p:Point,a:Point,b:Point){const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
export function eraseStroke(stroke:Stroke,from:Point,to:Point,radius:number):Stroke[]{
 const limit=radius+stroke.width/2,minX=Math.min(from[0],to[0])-limit,maxX=Math.max(from[0],to[0])+limit,minY=Math.min(from[1],to[1])-limit,maxY=Math.max(from[1],to[1])+limit;
 let box=bounds.get(stroke);if(!box){box={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};for(const point of stroke.points){box.minX=Math.min(box.minX,point[0]);box.maxX=Math.max(box.maxX,point[0]);box.minY=Math.min(box.minY,point[1]);box.maxY=Math.max(box.maxY,point[1]);}bounds.set(stroke,box);}if(box.maxX<minX||box.minX>maxX||box.maxY<minY||box.minY>maxY)return [stroke];
 const fragments:Point[][]=[];let kept:Point[]=[],changed=false;
 const take=(p:Point)=>{if(distance(p,from,to)<=limit){changed=true;if(kept.length)fragments.push(kept);kept=[];}else kept.push(p);};
 take(stroke.points[0]);
 for(let i=1;i<stroke.points.length;i++){const a=stroke.points[i-1],b=stroke.points[i];if(Math.max(a[0],b[0])<minX||Math.min(a[0],b[0])>maxX||Math.max(a[1],b[1])<minY||Math.min(a[1],b[1])>maxY){kept.push(b);continue;}const count=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));for(let j=1;j<=count;j++)take([a[0]+(b[0]-a[0])*j/count,a[1]+(b[1]-a[1])*j/count]);}
 if(!changed)return [stroke];if(kept.length)fragments.push(kept);return fragments.filter(points=>points.length>0).map(points=>({...stroke,id:uid(),points}));
}
export function eraseElements(elements:Element[],from:Point,to:Point,radius:number){let changed=false;const result:Element[]=[];for(const element of elements){if(element.type!=="stroke"){result.push(element);continue;}const pieces=eraseStroke(element,from,to,radius);if(pieces.length!==1||pieces[0]!==element)changed=true;result.push(...pieces);}return changed?result:elements;}
