import{NextResponse}from"next/server";import{linkTelegram,subscriptionByTelegram,deliverAlert}from"@/lib/alert-store";import{sendTelegramMessage,rugPrintKeyboard,setTelegramCommands,inlineLink}from"@/lib/telegram";
export const runtime="nodejs";
function valid(req:Request){const s=process.env.TELEGRAM_WEBHOOK_SECRET?.trim();return Boolean(s)&&req.headers.get("x-telegram-bot-api-secret-token")===s;}
const base=()=>`https://${process.env.RAILWAY_PUBLIC_DOMAIN||"rugprint-production.up.railway.app"}`;
async function menu(c:string,text:string){await sendTelegramMessage(c,text,{reply_markup:rugPrintKeyboard});}
export async function POST(req:Request){if(!valid(req))return NextResponse.json({ok:false},{status:401});try{const u=await req.json(),m=u?.message,c=String(m?.chat?.id||""),t=String(m?.text||"").trim();if(!c)return NextResponse.json({ok:true});const[cmd,arg=""]=t.split(/\s+/,2);
if(cmd==="/start"){const sub=await linkTelegram(arg.trim()||`telegram:${c}`,c);await setTelegramCommands().catch(()=>null);await menu(c,`🛡️ <b>RugPrint connected.</b>\nPlan: <b>${sub?.plan==="pro"?"Pro":"Trial"}</b>${sub?.plan==="pro"?"":" • 3 delivered alerts/month"}.\n\nChoose an action below.`);}
else if(cmd==="/status"||t==="📊 Status"){const s=await subscriptionByTelegram(c);await menu(c,s?`📊 <b>RugPrint status</b>\nPlan: <b>${s.plan==="pro"?"Pro":"Trial"}</b>\nAlerts used this month: <b>${Number(s.alerts_used||0)}</b>${s.plan==="pro"?"":" / 3"}`:"Send /start first.");}
else if(cmd==="/testalert"){const s=await subscriptionByTelegram(c);if(s)await deliverAlert(s.id,"test","RugPrint test alert","Telegram delivery is working.");else await menu(c,"Send /start first.");}
else if(cmd==="/help"||t==="❓ Help"){await menu(c,"❓ <b>RugPrint Help</b>\n\n🔎 Check Creator opens Creator Intelligence.\n🚨 My Alerts opens your watchlist.\n📊 Status shows plan and monthly usage.\n📝 Report Creator opens evidence reporting.\n\nWallet and contract watches can be monitored automatically. Username watches remain stored but require a verified identity-to-wallet link before on-chain monitoring can begin.");}
else if(t==="🔎 Check Creator"){await sendTelegramMessage(c,"🔎 <b>Creator Intelligence</b>\nSearch creator wallets and RugPrint identity evidence.",{reply_markup:inlineLink("Open RugPrint 🔎",`${base()}/creator`)});}
else if(t==="🚨 My Alerts"){await sendTelegramMessage(c,"🚨 <b>RugPrint Alerts</b>\nManage the wallets, contracts and creator identities you follow.",{reply_markup:inlineLink("Open My Alerts 🚨",`${base()}/alerts`)});}
else if(t==="📝 Report Creator"){await sendTelegramMessage(c,"📝 <b>Submit evidence</b>\nCommunity reports stay separate from verified RugPrint findings.",{reply_markup:inlineLink("Report on RugPrint 📝",`${base()}/report`)});}
else if(t==="💎 Upgrade to Pro"){await menu(c,"💎 <b>RugPrint Pro</b>\nOne-off price: <b>0.5 SOL</b>\nUnlimited delivered Telegram alerts.\n\nAutomatic payment activation is not live yet. Do not send funds until RugPrint gives you a payment reference.");}
else{await menu(c,"Choose an option from the RugPrint menu below.");}
return NextResponse.json({ok:true});}catch(e){console.error(e);return NextResponse.json({ok:true});}}
