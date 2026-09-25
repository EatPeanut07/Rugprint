export type CreatorHistoryItem={signature:string;blockTime:number|null;type:string|null;source:string|null;description:string|null};
export type VerifiedLaunch={signature:string;mint:string|null;launchedAt:string|null;source:string;confidence:number;outcome:string;evidenceConfidence:number|null;creatorSellCount:number};
export type CreatorIntelligence={wallet:string;provider:"helius";transactions:CreatorHistoryItem[];observedTransactions:number;verifiedLaunchCount:number;verifiedLaunches:VerifiedLaunch[];outcomeSummary:Record<string,number>;transferSignals:number;swapSignals:number;indexing:{queued:boolean;message:string};notes:string[]};
const cache=new Map<string,{until:number,value:CreatorIntelligence}>(),valid=(v:string)=>/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v),wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const endpoint=process.env.SUPABASE_URL?.replace(/\/$/,""),key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
async function db(path:string){if(!endpoint||!key)return[];const r=await fetch(`${endpoint}/rest/v1/${path}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:"no-store"});if(!r.ok)throw new Error(`Creator evidence database error (${r.status}).`);return await r.json()}
async function history(wallet:string){const k=process.env.HELIUS_API_KEY?.trim();if(!k)throw new Error("Helius is not configured.");const u=`https://api.helius.xyz/v0/addresses/${encodeURIComponent(wallet)}/transactions?api-key=${encodeURIComponent(k)}&limit=60`;for(let i=0;i<4;i++){const x=await fetch(u,{cache:"no-store"});if(x.ok)return await x.json();if((x.status===429||x.status>=500)&&i<3){await wait(600*2**i);continue}throw new Error(`Helius history request failed (${x.status}).`)}return[]}
export async function inspectCreatorWallet(wallet:string):Promise<CreatorIntelligence>{
 if(!valid(wallet))throw new Error("Enter a valid Solana creator wallet.");const c=cache.get(wallet);if(c&&c.until>Date.now())return c.value;
 const [raw,ls,outs]=await Promise.all([
  history(wallet),
  db(`rugprint_launch_observations?creator_wallet=eq.${encodeURIComponent(wallet)}&select=signature,token_mint,launched_at,source,confidence&order=launched_at.desc&limit=250`),
  db(`rugprint_launch_outcomes?creator_wallet=eq.${encodeURIComponent(wallet)}&select=launch_signature,token_mint,outcome,evidence_confidence,creator_sell_signatures,evidence,assessed_at&limit=250`)
 ]);
 const transactions=raw.map((x:any)=>({signature:String(x.signature||""),blockTime:typeof x.timestamp==="number"?x.timestamp:null,type:x.type??null,source:x.source??null,description:x.description??null})).filter((x:any)=>x.signature);
 const bySig=new Map((outs||[]).map((x:any)=>[String(x.launch_signature||""),x]));
 const verifiedLaunches=(ls||[]).map((x:any)=>{const o:any=bySig.get(String(x.signature||""));return{signature:x.signature,mint:x.token_mint||null,launchedAt:x.launched_at||null,source:x.source||"on-chain",confidence:Number(x.confidence||0),outcome:String(o?.outcome||"unclassified"),evidenceConfidence:o?.evidence_confidence==null?null:Number(o.evidence_confidence),creatorSellCount:Array.isArray(o?.creator_sell_signatures)?o.creator_sell_signatures.length:0}});
 const outcomeSummary:Record<string,number>={};for(const l of verifiedLaunches)outcomeSummary[l.outcome]=(outcomeSummary[l.outcome]||0)+1;
 const value={wallet,provider:"helius" as const,transactions,observedTransactions:transactions.length,verifiedLaunchCount:verifiedLaunches.length,verifiedLaunches,outcomeSummary,transferSignals:transactions.filter((x:any)=>String(x.type||"").toUpperCase()==="TRANSFER").length,swapSignals:transactions.filter((x:any)=>String(x.type||"").toUpperCase()==="SWAP").length,indexing:{queued:false,message:verifiedLaunches.length?"Historical launch records found in RugPrint.":"No verified historical launches are indexed for this wallet yet."},notes:["Verified launches use strict RugPrint on-chain evidence.","Unclassified means RugPrint has not yet established a supported outcome. A dead or failed token is not automatically a rug."]};
 cache.set(wallet,{until:Date.now()+30000,value});return value;
}
