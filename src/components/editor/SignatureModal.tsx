"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseSavedSignature, signatureCanvasPoint, signatureFromStrokes, type SignatureResult } from "@/lib/editor/signature";
export type { SignatureResult } from "@/lib/editor/signature";

type SignatureTab="draw"|"type"|"upload";
const RECENT_SIGNATURE_KEY="pdfpilot-recent-signature";
export function SignatureModal({onInsert,onClose,label="signature"}:{onInsert:(value:SignatureResult)=>void;onClose:()=>void;label?:"signature"|"initials"|"stamp"|"name"}) {
  const [tab,setTab]=useState<SignatureTab>(label==="stamp"?"upload":label==="name"||label==="initials"?"type":"draw");
  const [color,setColor]=useState("#1d4ed8"),[typedText,setTypedText]=useState("");
  const [typeStyle,setTypeStyle]=useState<"regular"|"italic"|"bold">(label==="name"?"regular":"italic");
  const [drawing,setDrawing]=useState(false),[upload,setUpload]=useState<SignatureResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [recent,setRecent]=useState<SignatureResult|null>(null),[remember,setRemember]=useState(false);
  const canvasRef=useRef<HTMLCanvasElement>(null),dialogRef=useRef<HTMLDivElement>(null),paths=useRef<{x:number;y:number}[][]>([]),current=useRef<{x:number;y:number}[]|null>(null),uploadVersion=useRef(0);
  useEffect(()=>{try{const raw=localStorage.getItem(RECENT_SIGNATURE_KEY);if(raw)setRecent(parseSavedSignature(raw));}catch{}const previous=document.activeElement as HTMLElement|null,pendingVersion=uploadVersion;dialogRef.current?.focus();return()=>{pendingVersion.current++;previous?.focus();};},[]);
  const redraw=useCallback(()=>{const canvas=canvasRef.current,ctx=canvas?.getContext("2d");if(!canvas||!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.lineCap="round";ctx.lineJoin="round";for(const path of [...paths.current,...(current.current?[current.current]:[])]){if(path.length<2)continue;ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);for(const point of path.slice(1))ctx.lineTo(point.x,point.y);ctx.stroke();}},[color]);
  useEffect(()=>{if(tab==="draw")redraw();},[tab,redraw]);
  const point=(e:React.PointerEvent<HTMLCanvasElement>)=>signatureCanvasPoint(e.clientX,e.clientY,e.currentTarget.getBoundingClientRect(),e.currentTarget.width,e.currentTarget.height);
  const finishStroke=()=>{if(current.current&&current.current.length>=2){paths.current.push(current.current);setDrawing(true);}current.current=null;redraw();};
  const insert=(value:SignatureResult)=>{if(remember){try{localStorage.setItem(RECENT_SIGNATURE_KEY,JSON.stringify(value));}catch{setError("This browser could not remember the signature. You can still insert it.");}}onInsert(value);};
  const handleInsert=()=>{try{
    if(tab==="draw"&&drawing)insert(signatureFromStrokes(paths.current,color));
    else if(tab==="type"&&typedText.trim()){
      const fontSize=30,canvas=document.createElement("canvas"),ctx=canvas.getContext("2d")!;
      ctx.font=`${typeStyle==="italic"?"italic ":typeStyle==="bold"?"bold ":""}${fontSize}px Arial`;
      insert({kind:"type",text:typedText.trim(),color,fontSize,fontStyle:typeStyle==="italic"?"italic":"normal",fontWeight:typeStyle==="bold"?"bold":"normal",width:Math.max(120,ctx.measureText(typedText.trim()).width*1.5+16),height:fontSize*1.5*1.5});
    }else if(tab==="upload"&&upload)insert(upload);
  }catch(e){setError(e instanceof Error?e.message:"Create a signature first.");}};
  const chooseImage=async(file:File|undefined)=>{if(!file)return;const id=++uploadVersion.current;setUpload(null);setBusy(true);setError("");
    try{
      if(file.size>5*1024*1024)throw new Error("Choose a PNG or JPG image smaller than 5MB.");
      const bytes=new Uint8Array(await file.arrayBuffer());const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
      if(!png&&!jpeg)throw new Error("Choose a valid PNG or JPG image.");
      const url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("This image could not be read. Choose it again."));reader.readAsDataURL(new Blob([bytes],{type:png?"image/png":"image/jpeg"}));});
      const image=new Image();image.src=url;await image.decode();if(image.naturalWidth*image.naturalHeight>25_000_000)throw new Error("This image is too large. Resize it below 25 megapixels first.");
      const factor=Math.min(320/image.naturalWidth,160/image.naturalHeight,1);
      if(id!==uploadVersion.current)return;setUpload({kind:"upload",dataUrl:url,format:png?"png":"jpeg",width:Math.max(1,image.naturalWidth*factor),height:Math.max(1,image.naturalHeight*factor),color});
    }catch(e){if(id===uploadVersion.current)setError(e instanceof Error?e.message:"This image could not be opened. Choose a valid PNG or JPG.");}
    finally{if(id===uploadVersion.current)setBusy(false);}
  };
  const canInsert=!busy&&((tab==="draw"&&drawing)||(tab==="type"&&!!typedText.trim())||(tab==="upload"&&!!upload));
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" onClick={onClose}>
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="signature-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl outline-none dark:border-slate-700 dark:bg-slate-900" onClick={e=>e.stopPropagation()} onKeyDown={e=>{
      e.stopPropagation();if(e.key==="Escape"){e.preventDefault();onClose();}if(e.key==="Tab"){const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'));const first=controls[0],last=controls.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    }}>
      <div className="mb-4 flex items-center justify-between"><h3 id="signature-title" className="text-lg font-bold">Add {label}</h3><button type="button" aria-label="Close signature dialog" onClick={onClose} className="rounded-full p-2 hover:bg-muted"><X className="h-4 w-4"/></button></div>
      <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-xl bg-muted p-1">{(["draw","type","upload"] as const).map(value=><button key={value} type="button" aria-pressed={tab===value} onClick={()=>{finishStroke();setTab(value);setError("");}} className={cn("rounded-lg py-2 text-sm font-medium capitalize",tab===value?"bg-background shadow":"text-muted-foreground")}>{value}</button>)}</div>
      {tab==="draw"&&<div className="space-y-3"><canvas ref={canvasRef} width={400} height={150} aria-label="Draw your signature" className="w-full touch-none rounded-xl border-2 border-dashed bg-slate-50 dark:bg-slate-950" style={{aspectRatio:"400/150"}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);current.current=[point(e)];setError("");}} onPointerMove={e=>{if(!current.current)return;if(paths.current.reduce((n,p)=>n+p.length,0)+current.current.length>=20000){finishStroke();setError("Drawing limit reached. Insert this signature or clear it and draw a shorter one.");return;}const p=point(e),last=current.current.at(-1)!;if(Math.hypot(p.x-last.x,p.y-last.y)>.5){current.current.push(p);redraw();}}} onPointerUp={finishStroke} onPointerCancel={finishStroke}/><div className="flex justify-end gap-4"><button type="button" disabled={!drawing} onClick={()=>{paths.current.pop();setDrawing(paths.current.length>0);redraw();}} className="text-sm underline disabled:opacity-40">Undo stroke</button><button type="button" onClick={()=>{paths.current=[];current.current=null;setDrawing(false);redraw();}} className="text-sm underline">Clear drawing</button></div></div>}
      {tab==="type"&&<div className="space-y-3"><label className="block space-y-1 text-sm">{label==="initials"?"Your initials":label==="stamp"?"Stamp text":"Your name"}<input aria-label="Signature text" value={typedText} maxLength={label==="initials"?20:200} onChange={e=>setTypedText(e.target.value)} className="h-11 w-full rounded-xl border bg-background px-3"/></label><div className="flex gap-2">{(["regular","italic","bold"] as const).map(style=><button key={style} type="button" aria-pressed={typeStyle===style} onClick={()=>setTypeStyle(style)} className={cn("rounded-lg border px-3 py-2 text-sm capitalize",typeStyle===style&&"bg-muted")}>{style}</button>)}</div><div className="flex min-h-24 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-slate-50 p-3 dark:bg-slate-950"><span className="break-all" style={{fontFamily:"Arial, sans-serif",fontSize:30,fontStyle:typeStyle==="italic"?"italic":"normal",fontWeight:typeStyle==="bold"?"bold":"normal",color}}>{typedText||"Preview"}</span></div></div>}
      {tab==="upload"&&<div className="space-y-3"><label className="block space-y-2 text-sm">Choose a PNG or JPG image<input aria-label="Signature image" type="file" accept="image/png,image/jpeg" onChange={e=>void chooseImage(e.target.files?.[0])} className="block w-full text-sm"/></label><p className="text-xs text-muted-foreground">Up to 5MB. Transparent PNG keeps the document visible around your signature.</p>{busy&&<p role="status">Reading image…</p>}{upload&&<div className="rounded-xl border bg-white p-3">
{/* eslint-disable-next-line @next/next/no-img-element -- local file preview */}
<img src={upload.dataUrl} alt="Signature image preview" className="mx-auto max-h-32 max-w-full object-contain"/></div>}</div>}
      {tab!=="upload"&&<fieldset className="mt-4 flex items-center gap-2"><legend className="mb-2 text-xs font-medium">Ink color</legend>{[["Blue","#1d4ed8"],["Black","#000000"],["Red","#dc2626"]].map(([name,value])=><button key={value} type="button" onClick={()=>setColor(value)} aria-label={name+" ink"} aria-pressed={color===value} style={{backgroundColor:value}} className={cn("h-7 w-7 rounded-full border-2",color===value?"ring-2 ring-orange-500 ring-offset-2":"border-transparent")}/>)}</fieldset>}
      {error&&<p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
      <label className="mt-4 flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Remember {label==="initials"?"these initials":`this ${label}`} on this device</label>
      {recent&&<div className="mt-3 flex gap-2"><button type="button" onClick={()=>onInsert(recent)} className="flex-1 rounded-lg border px-3 py-2 text-xs">Use saved signature</button><button type="button" onClick={()=>{try{localStorage.removeItem(RECENT_SIGNATURE_KEY);}catch{}setRecent(null);}} className="rounded-lg border px-3 py-2 text-xs">Forget saved signature</button></div>}
      <button type="button" onClick={handleInsert} disabled={!canInsert} className="mt-4 min-h-12 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40 dark:bg-orange-500">Insert {label}</button>
    </div>
  </div>;
}
