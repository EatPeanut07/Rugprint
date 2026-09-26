"use client";
import{useEffect}from"react";

export default function AnalyticsTracker(){
 useEffect(()=>{
  let id=localStorage.getItem("rugprint_visitor_id");
  if(!id){id=crypto.randomUUID();localStorage.setItem("rugprint_visitor_id",id)}
  const send=(eventName:string,properties:Record<string,unknown>={})=>{
   const payload=JSON.stringify({visitorId:id,eventName,category:"product",properties,path:location.pathname});
   fetch("/api/analytics/track",{method:"POST",headers:{"Content-Type":"application/json"},body:payload,keepalive:true})
    .then(r=>{if(!r.ok)console.warn("RugPrint analytics rejected",r.status)})
    .catch(e=>console.warn("RugPrint analytics delivery failed",e));
  };
  send("page_view");
  const click=(e:MouseEvent)=>{
   const el=(e.target as HTMLElement)?.closest?.("a,button") as HTMLElement|null;
   if(el)send("ui_click",{label:el.innerText?.slice(0,80)||""});
  };
  document.addEventListener("click",click);
  return()=>document.removeEventListener("click",click);
 },[]);
 return null;
}
