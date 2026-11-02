export interface Clip { x:number;y:number;width:number;height:number }
export const FULL_CLIP:Clip={x:0,y:0,width:1,height:1};
export async function loadImage(source:string){const image=new Image();image.src=source;await image.decode();return image;}
export async function imageData(source:Blob|string,clip:Clip=FULL_CLIP,max=1600,format="image/webp"){
  const url=typeof source==="string"?source:URL.createObjectURL(source);
  try{const image=await loadImage(url);const w=Math.max(1,image.naturalWidth*clip.width),h=Math.max(1,image.naturalHeight*clip.height),scale=Math.min(1,max/Math.max(w,h));const canvas=document.createElement("canvas");canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);canvas.getContext("2d")!.drawImage(image,image.naturalWidth*clip.x,image.naturalHeight*clip.y,w,h,0,0,canvas.width,canvas.height);let target=format;if(format==="auto-pdf"){const pixels=canvas.getContext("2d")!.getImageData(0,0,canvas.width,canvas.height).data;target="image/jpeg";for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255){target="image/png";break;}}return {src:canvas.toDataURL(target,.86),width:canvas.width,height:canvas.height};}finally{if(typeof source!=="string")URL.revokeObjectURL(url);}
}
