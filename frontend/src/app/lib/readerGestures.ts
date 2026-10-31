interface Point { identifier: number; clientX: number; clientY: number }
/** Three-finger hold and one-finger tap/swipe never share a gesture. */
export function installReaderGestures(element: HTMLElement, options: { tap: () => void; swipe: (next: boolean) => void; adjust: () => void; canSwipe: () => boolean }) {
  let single: { x: number; y: number; time: number; moved: number } | null = null;
  let triple: Point[] | null = null, timer: ReturnType<typeof setTimeout> | undefined;
  let multi = false;
  const clearHold = () => { clearTimeout(timer); triple = null; };
  const start = (event: TouchEvent) => {
    if (event.touches.length > 1) { multi = true; single = null; clearHold(); }
    if (event.touches.length === 3) {
      event.preventDefault(); triple = Array.from(event.touches).map(p => ({ identifier:p.identifier,clientX:p.clientX,clientY:p.clientY }));
      timer = setTimeout(() => { triple = null; options.adjust(); }, 3000);
    } else if (event.touches.length === 1 && !multi) {
      const point = event.touches[0]; single = { x:point.clientX,y:point.clientY,time:Date.now(),moved:0 };
    }
  };
  const move = (event: TouchEvent) => {
    if (triple) {
      event.preventDefault();
      if (event.touches.length !== 3 || triple.some(origin => { const point = Array.from(event.touches).find(p => p.identifier === origin.identifier); return !point || Math.hypot(point.clientX-origin.clientX,point.clientY-origin.clientY)>16; })) clearHold();
    }
    if (single && event.touches.length === 1) { const point=event.touches[0]; if(options.canSwipe() && Math.abs(point.clientX-single.x)>12 && Math.abs(point.clientX-single.x)>Math.abs(point.clientY-single.y)*1.6) event.preventDefault(); single.moved=Math.max(single.moved,Math.hypot(point.clientX-single.x,point.clientY-single.y)); }
  };
  const end = (event: TouchEvent) => {
    clearHold();
    const origin=single; single=null;
    if (multi) { if (!event.touches.length) multi=false; return; }
    if (!origin || event.changedTouches.length!==1 || event.touches.length) return;
    const point=event.changedTouches[0],dx=point.clientX-origin.x,dy=point.clientY-origin.y,elapsed=Date.now()-origin.time;
    if(options.canSwipe() && Math.abs(dx)>55 && Math.abs(dx)>Math.abs(dy)*1.6 && elapsed<1000) { event.preventDefault();options.swipe(dx<0);return; }
    if(origin.moved<12 && Math.hypot(dx,dy)<12 && elapsed<450) options.tap();
  };
  const cancel=()=>{clearHold();single=null;multi=false;};
  element.addEventListener("touchstart",start,{passive:false}); element.addEventListener("touchmove",move,{passive:false}); element.addEventListener("touchend",end,{passive:false});element.addEventListener("touchcancel",cancel);
  window.addEventListener("blur",cancel);
  return()=>{cancel();element.removeEventListener("touchstart",start);element.removeEventListener("touchmove",move);element.removeEventListener("touchend",end);element.removeEventListener("touchcancel",cancel);window.removeEventListener("blur",cancel);};
}
