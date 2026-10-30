import type { DrawObject, Point } from "./types";

export interface SignatureResult {
  kind: "draw" | "type" | "upload"; points?: Point[]; strokes?: Point[][];
  width: number; height: number; color: string; text?: string; dataUrl?: string;
  format?: "png" | "jpeg"; fontStyle?: "normal" | "italic"; fontWeight?: "normal" | "bold"; fontSize?: number;
}
export function signatureCanvasPoint(clientX:number,clientY:number,rect:{left:number;top:number;width:number;height:number},width:number,height:number):Point {
  return {x:Math.max(0,Math.min(width,(clientX-rect.left)/Math.max(1,rect.width)*width)),y:Math.max(0,Math.min(height,(clientY-rect.top)/Math.max(1,rect.height)*height))};
}
export function signatureFromStrokes(paths:Point[][],color:string):SignatureResult {
  const strokes=paths.filter(path=>path.length>=2);
  const points=strokes.flat();
  if(points.length<2||points.length>20000||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error("Draw a signature before inserting it. Very long drawings should be simplified.");
  const bounds=points.reduce((b,p)=>({left:Math.min(b.left,p.x),right:Math.max(b.right,p.x),top:Math.min(b.top,p.y),bottom:Math.max(b.bottom,p.y)}),{left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity});
  const normalized=strokes.map(path=>path.map(p=>({x:p.x-bounds.left,y:p.y-bounds.top})));
  return{kind:"draw",points:normalized.flat(),strokes:normalized,width:Math.max(1,bounds.right-bounds.left),height:Math.max(1,bounds.bottom-bounds.top),color};
}
/** Resizing changes the ink as well as its bounding box; strokes stay separate. */
export function scaledDrawStrokes(obj:DrawObject):Point[][] {
  const strokes=obj.strokes?.length?obj.strokes:[obj.points];
  const bounds=strokes.flat().reduce((b,p)=>({width:Math.max(b.width,p.x),height:Math.max(b.height,p.y)}),{width:1,height:1});
  return strokes.filter(path=>path.length>=2).map(path=>path.map(p=>({x:p.x*obj.width/bounds.width,y:p.y*obj.height/bounds.height})));
}
export function parseSavedSignature(raw:string):SignatureResult|null {
  try{const value=JSON.parse(raw) as SignatureResult;
    if(!value||!['draw','type','upload'].includes(value.kind)||![value.width,value.height].every(n=>Number.isFinite(n)&&n>0&&n<=10000)||!/^#[0-9a-f]{6}$/i.test(value.color))return null;
    if(value.kind==='type'&&(typeof value.text!=='string'||!value.text.trim()||value.text.length>200))return null;
    if(value.kind==='upload'&&(typeof value.dataUrl!=='string'||value.dataUrl.length>8_000_000||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value.dataUrl)))return null;
    if(value.kind==='draw'){
      if(!Array.isArray(value.points)||value.points.length<2||value.points.length>20000||value.points.some(p=>!p||![p.x,p.y].every(n=>Number.isFinite(n)&&n>=0&&n<=10000)))return null;
      if(value.strokes!==undefined&&(!Array.isArray(value.strokes)||value.strokes.some(stroke=>!Array.isArray(stroke))))return null;
      if(value.strokes&&JSON.stringify(value.strokes.flat())!==JSON.stringify(value.points))return null;
    }
    return{...value,fontSize:Math.min(60,Math.max(8,Number.isFinite(value.fontSize)?value.fontSize!:30)),fontStyle:value.fontStyle==='normal'?'normal':'italic',fontWeight:value.fontWeight==='bold'?'bold':'normal'};
  }catch{return null;}
}
