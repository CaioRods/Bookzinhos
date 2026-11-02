/** A notebook is not advertised as installed until its application shell is ready. */
export async function prepareNotebookOffline(){
 if(!import.meta.env.PROD)return;
 if(!("serviceWorker" in navigator))throw new Error("Este navegador não permite instalar o app offline. Use um navegador com suporte a PWA.");
 let timeout:ReturnType<typeof setTimeout>|undefined;
 try{
  await Promise.race([(async()=>{
   let registration=await navigator.serviceWorker.getRegistration();
   if(!registration)registration=await navigator.serviceWorker.ready;
   if(navigator.onLine)await registration.update();
   const worker=registration.installing||registration.waiting;
   if(worker&&worker.state!=="activated")await new Promise<void>((resolve,reject)=>{
    const state=()=>{if(worker.state==="activated"){worker.removeEventListener("statechange",state);resolve();}else if(worker.state==="redundant"){worker.removeEventListener("statechange",state);reject(new Error("Não foi possível preparar a versão offline. Tente novamente com conexão."));}};
    worker.addEventListener("statechange",state);state();
   });
   if(!registration.active)await navigator.serviceWorker.ready;
  })(),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error("A instalação do app ainda está sendo preparada. Aguarde um momento e tente novamente.")),30000);})]);
 }finally{clearTimeout(timeout);}
}
