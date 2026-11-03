export type Paper = "plain" | "parchment" | "ruled";
export type Point = [number, number];
export interface Stroke { id: string; type: "stroke"; points: Point[]; color: string; width: number; opacity: number }
export interface Box { id: string; x: number; y: number; width: number; height: number }
export interface TextElement extends Box { flow?: "ruled"; type: "text"; text: string; color: string; size: number; font: "sans" | "serif" | "mono"; bold: boolean; italic: boolean; underline: boolean; align: "left" | "center" | "right" }
export interface ImageElement extends Box { type: "image"; src: string; source?: { bookId: string; title: string; page: number; rect?: {x:number;y:number;width:number;height:number} } }
export type Element = Stroke | TextElement | ImageElement;
export interface Notebook { coverLayout?: import("./coverLayout").CoverLayout; id: string; name: string; description: string; color: string; icon: string; image: string; revision: string; updatedAt: number; pageCount?: number }
export interface PageSummary { id: string; title: string; paper: Paper; revision: string; position: number; updatedAt: number }
export interface NotebookPage extends PageSummary { elements: Element[] }
export interface Share { id: string; owner: string; name: string; pageId: string | null; createdAt: number }
export const uid = () => crypto.randomUUID();
export const blankPage = (position = Date.now()): NotebookPage => ({ id: uid(), title: "Nova página", paper: "ruled", elements: [], revision: uid(), position, updatedAt: Date.now() });
export const fontFamily = (font: string) => font === "serif" ? "NBSerif, Georgia, serif" : font === "mono" ? "NBMono, monospace" : "NBSans, Arial, sans-serif";
export function strokePath(points: Point[]) {
 if(points.length<3)return points.map(([x,y],i)=>`${i?"L":"M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")+(points.length===1?" l.1 .1":"");
 let path=`M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
 for(let i=1;i<points.length-1;i++){const p=points[i],next=points[i+1];path+=` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0]+next[0])/2).toFixed(1)} ${((p[1]+next[1])/2).toFixed(1)}`;}
 const last=points[points.length-1];return path+` L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
}
export const paperColor = (paper: Paper) => paper === "parchment" ? "#eddbac" : "#fffefb";
export function wrapText(text: string, width: number, size: number, measure: (text: string) => number = s => s.length * size * .53) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      if (line && measure(line + " " + word) <= width) { line += " " + word; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const char of word) { if (line && measure(line + char) > width) { lines.push(line); line = ""; } line += char; }
    }
    lines.push(line);
  }
  return lines;
}
export function coverInk(color:string){const value=color.replace('#',''),r=parseInt(value.slice(0,2),16),g=parseInt(value.slice(2,4),16),b=parseInt(value.slice(4,6),16);return r*.2126+g*.7152+b*.0722>160?'#263c35':'#fffaf1';}
export function strokeHit(stroke:Stroke,point:Point,radius:number){
 const limit=radius+stroke.width/2;
 for(let i=0;i<stroke.points.length;i++){
  const a=stroke.points[i],b=stroke.points[i+1]||a,dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)):0;
  if(Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)<=limit)return true;
 }
 return false;
}

/** The same baselines are used on every paper, in the editor and in exported PDFs. */
export const PAPER_GRID = { first:72, step:32, left:62, right:760, bottom:1064 } as const;
export const textLineHeight = (element:Pick<TextElement,"size"|"flow">) => element.flow === "ruled" ? Math.ceil(element.size*1.15/PAPER_GRID.step)*PAPER_GRID.step : element.size*1.4;
export const textBaselineInset = (element:Pick<TextElement,"size"|"flow">) => element.flow === "ruled" ? Math.ceil(element.size*.25)+2 : 0;
const firstTextRule = (size:number) => PAPER_GRID.first+Math.max(0,Math.ceil((size+textBaselineInset({size,flow:"ruled"})-PAPER_GRID.first)/PAPER_GRID.step))*PAPER_GRID.step;
export const textBaseline = (element:Pick<TextElement,"y"|"size"|"flow">, line:number) => (element.flow === "ruled" ? Math.max(element.y+element.size,firstTextRule(element.size)) : element.y+element.size)-textBaselineInset(element)+line*textLineHeight(element);
export const textVisibleLines = (element:Pick<TextElement,"y"|"size"|"height"|"flow">) => element.flow === "ruled" ? Math.max(1,1+Math.floor((Math.min(element.y+element.height,PAPER_GRID.bottom)-textBaseline(element,0)-textBaselineInset(element))/textLineHeight(element))) : Math.max(1,Math.floor(element.height/textLineHeight(element)));
export function snapTextY(y:number,size:number) {
 const first=firstTextRule(size);
 const baseline=Math.max(first,Math.min(PAPER_GRID.bottom,PAPER_GRID.first+Math.round((y+size-PAPER_GRID.first)/PAPER_GRID.step)*PAPER_GRID.step));
 return Math.max(0,baseline-size);
}
export function ruledTextBox(point:Point,size:number) {
 const x=Math.max(PAPER_GRID.left,Math.min(660,point[0]-4)),y=snapTextY(point[1]-size,size);
 return {x,y,width:PAPER_GRID.right-x,height:1100-y,flow:"ruled" as const};
}
