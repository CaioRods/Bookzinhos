import { useEffect } from "react";
import { syncNotebooks } from "../../lib/notebooks/store";
export function NotebookSync(){useEffect(()=>{const sync=()=>{void syncNotebooks().catch(()=>{});};sync();window.addEventListener("online",sync);window.addEventListener("mybooks:session",sync);const visible=()=>{if(document.visibilityState==="visible")sync();};document.addEventListener("visibilitychange",visible);return()=>{window.removeEventListener("online",sync);window.removeEventListener("mybooks:session",sync);document.removeEventListener("visibilitychange",visible);};},[]);return null;}
