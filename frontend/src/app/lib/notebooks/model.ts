export type Paper = "plain" | "parchment" | "ruled";
export type Point = [number, number];
export interface Stroke { id: string; type: "stroke"; points: Point[]; color: string; width: number; opacity: number }
export interface Box { id: string; x: number; y: number; width: number; height: number }
export interface TextElement extends Box { type: "text"; text: string; color: string; size: number; font: "sans" | "serif" | "mono"; bold: boolean; italic: boolean; underline: boolean; align: "left" | "center" | "right" }
export interface ImageElement extends Box { type: "image"; src: string; source?: { bookId: string; title: string; page: number; rect?: {x:number;y:number;width:number;height:number} } }
export type Element = Stroke | TextElement | ImageElement;
export interface Notebook { id: string; name: string; description: string; color: string; icon: string; image: string; revision: string; updatedAt: number; pageCount?: number }
export interface PageSummary { id: string; title: string; paper: Paper; revision: string; position: number; updatedAt: number }
export interface NotebookPage extends PageSummary { elements: Element[] }
export interface Share { id: string; owner: string; name: string; pageId: string | null; createdAt: number }
export const uid = () => crypto.randomUUID();
export const blankPage = (position = Date.now()): NotebookPage => ({ id: uid(), title: "Nova página", paper: "ruled", elements: [], revision: uid(), position, updatedAt: Date.now() });
export const fontFamily = (font: string) => font === "serif" ? "NBSerif, Georgia, serif" : font === "mono" ? "NBMono, monospace" : "NBSans, Arial, sans-serif";
export function strokePath(points: Point[]) { return points.map(([x,y],index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + (points.length === 1 ? " l.1 .1" : ""); }
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
