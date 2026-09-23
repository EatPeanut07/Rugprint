import{alertAllowance,type Plan}from"./alerts";const endpoint=process.env.SUPABASE_URL?.replace(/\/$/,""),key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;async function db(path:string,init?:RequestInit){if(!endpoint||!key)throw new Error("Alert database is not configured.");const r=await fetch(`${endpoint}/rest/v1/${path}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",Prefer:"return=representation",...(init?.headers||{})},cache:"no-store"});if(!r.ok)throw new Error(`Alert database error (${r.status})`);const t=await r.text();return t?JSON.parse(t):null;}function monthStart(){const d=new Date();return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-01`;}export async function quota(userKey:string){let rows=await db(`rugprint_alert_subscriptions?user_key=eq.${encodeURIComponent(userKey)}&select=*`);let row=rows?.[0];if(!row){rows=await db("rugprint_alert_subscriptions",{method:"POST",body:JSON.stringify({user_key:userKey,plan:"trial",alerts_used:0,quota_month:monthStart()})});row=rows[0];}if(String(row.quota_month).slice(0,7)!==monthStart().slice(0,7)){const u=await db(`rugprint_alert_subscriptions?id=eq.${row.id}`,{method:"PATCH",body:JSON.stringify({alerts_used:0,quota_month:monthStart(),updated_at:new Date().toISOString()})});row=u[0]||{...row,alerts_used:0,quota_month:monthStart()};}const plan:Plan=row.plan==="pro"?"pro":"trial";return{subscriptionId:row.id,plan,used:Number(row.alerts_used||0),...alertAllowance(plan,Number(row.alerts_used||0)),telegramConnected:Boolean(row.telegram_chat_id)};}export async function addWatch(userKey:string,type:string,value:string){const q=await quota(userKey);if(!["creator","wallet","contract","pumpfun","fomo","x"].includes(type))throw new Error("Unsupported watch type.");const rows=await db("rugprint_alert_watches?on_conflict=subscription_id,watch_type,watch_value",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({subscription_id:q.subscriptionId,watch_type:type,watch_value:value,enabled:true})});return{watch:rows?.[0],quota:q};}export async function listWatches(userKey:string){const q=await quota(userKey);const watches=await db(`rugprint_alert_watches?subscription_id=eq.${q.subscriptionId}&select=*&order=created_at.desc`);return{quota:q,watches:watches||[]};}

const TELEGRAM_TOKEN=process.env.TELEGRAM_BOT_TOKEN;

export async function linkTelegramChat(userKey:string,telegramChatId:string){
  const q=await quota(userKey);
  await db(`rugprint_alert_subscriptions?id=eq.${q.subscriptionId}`,{method:"PATCH",body:JSON.stringify({telegram_chat_id:telegramChatId,updated_at:new Date().toISOString()})});
  return{subscriptionId:q.subscriptionId,message:"Telegram chat linked to your Rugprint alert subscription."};
}

export async function getTelegramChatId(subscriptionId:string):Promise<string|null>{
  const rows=await db(`rugprint_alert_subscriptions?id=eq.${subscriptionId}&select=telegram_chat_id`);
  const row=rows?.[0];
  return row?.telegram_chat_id||null;
}

export async function deliverTelegramAlert(subscriptionId:string,watchType:string,watchValue:string,alertDetails:string):Promise<{success:boolean,error?:string}>{
  const rows=await db(`rugprint_alert_subscriptions?id=eq.${subscriptionId}&select=*`);
  const sub=rows?.[0];
  if(!sub)return{success:false,error:"subscription_not_found"};
  if(!sub.telegram_chat_id)return{success:false,error:"telegram_not_linked"};
  const plan:Plan=sub.plan==="pro"?"pro":"trial";
  if(plan==="trial"&&Number(sub.alerts_used||0)>=3)return{success:false,error:"quota_exceeded"};

  const chatId=sub.telegram_chat_id;
  const messageContent=`<b>\u{1F6A8} Alert</b>\n<b>${watchType}</b>: ${watchValue}\n\n${alertDetails}`;

  if(!TELEGRAM_TOKEN){
    await db("rugprint_alert_deliveries",{method:"POST",body:JSON.stringify({subscription_id:subscriptionId,watch_type:watchType,watch_value:watchValue,delivery_channel:"telegram",chat_id:chatId,message_content:messageContent,delivery_failed_reason:"telegram_not_configured"})}).catch(()=>{});
    return{success:false,error:"telegram_not_configured"};
  }

  let tgRes:Response;
  try{
    tgRes=await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chatId,text:messageContent,parse_mode:"HTML"})});
  }catch(e){
    await db("rugprint_alert_deliveries",{method:"POST",body:JSON.stringify({subscription_id:subscriptionId,watch_type:watchType,watch_value:watchValue,delivery_channel:"telegram",chat_id:chatId,message_content:messageContent,delivery_failed_reason:"telegram_unreachable"})}).catch(()=>{});
    return{success:false,error:"telegram_unreachable"};
  }

  if(!tgRes.ok){
    const failReason=tgRes.status>=500?"telegram_unreachable":`telegram_error_${tgRes.status}`;
    await db("rugprint_alert_deliveries",{method:"POST",body:JSON.stringify({subscription_id:subscriptionId,watch_type:watchType,watch_value:watchValue,delivery_channel:"telegram",chat_id:chatId,message_content:messageContent,delivery_failed_reason:failReason})}).catch(()=>{});
    return{success:false,error:failReason};
  }

  await db(`rugprint_alert_subscriptions?id=eq.${subscriptionId}`,{method:"PATCH",body:JSON.stringify({alerts_used:Number(sub.alerts_used||0)+1,updated_at:new Date().toISOString()})});
  await db("rugprint_alert_deliveries",{method:"POST",body:JSON.stringify({subscription_id:subscriptionId,watch_type:watchType,watch_value:watchValue,delivery_channel:"telegram",chat_id:chatId,message_content:messageContent,delivered_at:new Date().toISOString()})}).catch(()=>{});

  return{success:true};
}