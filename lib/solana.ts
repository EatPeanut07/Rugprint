import { createHash } from "node:crypto";
import type { Confidence, CreatorLaunch, Evidence, HolderStats, ScanResult, TokenMeta, WalletLink } from "./types";

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
const LAMPORTS = 1_000_000_000;
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const TOKEN_PROGRAMS = new Set(["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA","TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]);
const RPC_TIMEOUT_MS=18_000, MAX_RETRIES=4, CACHE_TTL_MS=30_000;
const cache=new Map<string,{expires:number,value:unknown}>();

function sleep(ms:number){return new Promise(r=>setTimeout(r,ms));}
function rpcUrl(){const key=process.env.HELIUS_API_KEY?.trim(); if(key)return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`; return process.env.SOLANA_RPC_URL?.trim()||DEFAULT_RPC;}
function cacheKey(method:string,params:unknown){return `${method}:${JSON.stringify(params)}`;}

async function rpc<T>(method:string,params:unknown,opts:{cacheMs?:number}={}):Promise<T>{
  const key=cacheKey(method,params), cached=cache.get(key);
  if(cached && cached.expires>Date.now()) return cached.value as T;
  let last:unknown;
  for(let attempt=0;attempt<=MAX_RETRIES;attempt++){
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),RPC_TIMEOUT_MS);
    try{
      const res=await fetch(rpcUrl(),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),cache:"no-store",signal:controller.signal});
      const text=await res.text();
      if(res.ok){
        const body=JSON.parse(text);
        if(body.error) throw new Error(body.error.message||"Solana RPC error");
        const value=body.result as T; cache.set(key,{expires:Date.now()+(opts.cacheMs??CACHE_TTL_MS),value}); return value;
      }
      if((res.status===429 || res.status>=500) && attempt<MAX_RETRIES){
        const retry=Number(res.headers.get("retry-after")); const base=Number.isFinite(retry)&&retry>0?retry*1000:Math.min(8000,750*(2**attempt));
        await sleep(base+Math.floor(Math.random()*250)); continue;
      }
      if(res.status===401 || res.status===403) throw new Error("Solana data provider rejected the request. Check the Helius API key in Railway.");
      throw new Error(`RPC ${res.status}: ${text.slice(0,240)}`);
    }catch(e){
      last=e;
      if(attempt>=MAX_RETRIES) break;
      if(e instanceof Error && /rejected the request|valid Solana/.test(e.message)) throw e;
      await sleep(Math.min(8000,750*(2**attempt))+Math.floor(Math.random()*250));
    }finally{clearTimeout(timeout);}
  }
  if(last instanceof Error && /429|Too many requests/i.test(last.message)) throw new Error("Solana data provider is temporarily rate limited. RugPrint retried automatically. Please try the scan again shortly.");
  if(last instanceof Error && last.name==="AbortError") throw new Error("Solana data provider timed out. Please try the scan again.");
  throw last instanceof Error?last:new Error("Solana data provider unavailable.");
}

function isPubkey(v:string){return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);}
function pct(v:bigint,t:bigint){return t===0n?null:Number((v*1_000_000n)/t)/10_000;}
function label(s:number):ScanResult["risk"]["label"]{return s>=75?"SEVERE":s>=50?"HIGH":s>=25?"GUARDED":"LOW";}
function confidenceWeight(c:Confidence){return c==="confirmed"?1:c==="strong"?.75:c==="possible"?.35:0;}
type Sig={signature:string;blockTime:number|null;err:unknown|null;slot:number};
type ParsedTx={blockTime:number|null;transaction:{signatures:string[];message:{accountKeys:Array<{pubkey:string;signer:boolean;writable:boolean}|string>;instructions:any[]}};meta?:{preBalances?:number[];postBalances?:number[];preTokenBalances?:any[];postTokenBalances?:any[];innerInstructions?:Array<{index:number;instructions:any[]}>}|null};
function keyString(k:ParsedTx["transaction"]["message"]["accountKeys"][number]){return typeof k==="string"?k:k.pubkey;}

async function getSignatures(address:string,pageLimit=3){const all:Sig[]=[];let before:string|undefined;for(let p=0;p<pageLimit;p++){const batch=await rpc<Sig[]>("getSignaturesForAddress",[address,{commitment:"confirmed",limit:500,...(before?{before}:{})}],{cacheMs:60_000});all.push(...batch);if(batch.length<500)break;before=batch.at(-1)?.signature;if(!before)break;}return all;}
async function getTx(sig:string){return rpc<ParsedTx|null>("getTransaction",[sig,{commitment:"confirmed",encoding:"jsonParsed",maxSupportedTransactionVersion:0}],{cacheMs:120_000});}

async function getTokenMeta(mint:string):Promise<TokenMeta>{
 const [supplyRes,accountRes]=await Promise.all([rpc<any>("getTokenSupply",[mint,{commitment:"confirmed"}]),rpc<any>("getAccountInfo",[mint,{commitment:"confirmed",encoding:"jsonParsed"}])]);
 const parsed=accountRes?.value?.data?.parsed?.info||{},decimals=Number(supplyRes?.value?.decimals??parsed?.decimals??0),amountRaw=BigInt(supplyRes?.value?.amount??"0");
 let name:null|string=null,symbol:null|string=null,image:null|string=null;
 if(process.env.HELIUS_API_KEY?.trim()){try{const asset=await rpc<any>("getAsset",{id:mint,displayOptions:{showFungible:true}},{cacheMs:300_000});name=asset?.content?.metadata?.name??null;symbol=asset?.content?.metadata?.symbol??null;image=asset?.content?.links?.image??asset?.content?.files?.[0]?.uri??null;}catch{}}
 return {mint,name,symbol,image,decimals,supply:Number(amountRaw)/Math.pow(10,decimals),mintAuthority:parsed?.mintAuthority??null,freezeAuthority:parsed?.freezeAuthority??null};
}
async function getHolderStats(mint:string):Promise<HolderStats>{const [s,l]=await Promise.all([rpc<any>("getTokenSupply",[mint,{commitment:"confirmed"}]),rpc<any>("getTokenLargestAccounts",[mint,{commitment:"confirmed"}])]);const total=BigInt(s?.value?.amount??"0"),vals:bigint[]=(l?.value||[]).map((x:any)=>BigInt(x.amount||"0")),sum=(n:number)=>vals.slice(0,n).reduce((a,b)=>a+b,0n);return{top1Pct:pct(sum(1),total),top5Pct:pct(sum(5),total),top10Pct:pct(sum(10),total),accountsChecked:vals.length};}
function parsedSystemTransfers(tx:ParsedTx){const out:Array<{from:string;to:string;lamports:number;signature:string}>=[],sig=tx.transaction.signatures[0];const inspect=(ix:any)=>{if(ix?.program==="system"&&ix?.parsed?.type==="transfer"){const i=ix.parsed.info||{};if(i.source&&i.destination&&typeof i.lamports==="number")out.push({from:i.source,to:i.destination,lamports:i.lamports,signature:sig});}};tx.transaction.message.instructions.forEach(inspect);tx.meta?.innerInstructions?.forEach(g=>g.instructions.forEach(inspect));return out;}
function parsedMintInitializations(tx:ParsedTx){const m:string[]=[];const inspect=(ix:any)=>{if((ix?.program==="spl-token"||TOKEN_PROGRAMS.has(ix?.programId))&&["initializeMint","initializeMint2"].includes(ix?.parsed?.type)){const mint=ix?.parsed?.info?.mint;if(mint&&isPubkey(mint))m.push(mint);}};tx.transaction.message.instructions.forEach(inspect);tx.meta?.innerInstructions?.forEach(g=>g.instructions.forEach(inspect));return[...new Set(m)];}
function signerWallets(tx:ParsedTx){return tx.transaction.message.accountKeys.filter(k=>typeof k!=="string"&&k.signer).map(keyString);}
async function boundedMap<T,R>(items:T[],limit:number,fn:(x:T,i:number)=>Promise<R>){const results:R[]=new Array(items.length);let cursor=0;async function worker(){while(cursor<items.length){const i=cursor++;results[i]=await fn(items[i],i);await sleep(35);}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return results;}
function scoreRisk(meta:TokenMeta,h:HolderStats,links:WalletLink[],previous:CreatorLaunch[]){let score=0;const reasons:string[]=[];if(meta.mintAuthority){score+=12;reasons.push("Mint authority is still enabled");}if(meta.freezeAuthority){score+=8;reasons.push("Freeze authority is still enabled");}if((h.top10Pct??0)>=70){score+=25;reasons.push(`Top 10 token accounts hold ${h.top10Pct?.toFixed(1)}% of supply`);}else if((h.top10Pct??0)>=50){score+=15;reasons.push(`Top 10 token accounts hold ${h.top10Pct?.toFixed(1)}% of supply`);}else if((h.top10Pct??0)>=30){score+=7;reasons.push(`Top 10 token accounts hold ${h.top10Pct?.toFixed(1)}% of supply`);}const w=links.reduce((a,l)=>a+confidenceWeight(l.confidence),0);if(w>=4){score+=15;reasons.push("Multiple creator-adjacent wallet relationships were observed");}else if(w>=2){score+=8;reasons.push("Several creator-adjacent wallet relationships were observed");}if(previous.length>=5){score+=25;reasons.push(`${previous.length} other mint initialisations were found around the creator wallet history`);}else if(previous.length>=2){score+=14;reasons.push(`${previous.length} other mint initialisations were found around the creator wallet history`);}else if(previous.length===1){score+=5;reasons.push("Another mint initialisation was found around the creator wallet history");}score=Math.min(100,score);if(!reasons.length)reasons.push("No high-weight risk signal was confirmed in the bounded scan");return{score,label:label(score),reasons,dataConfidence:"strong" as Confidence};}

export async function analyzeMint(mint:string):Promise<ScanResult>{
 if(!isPubkey(mint))throw new Error("That does not look like a valid Solana address.");
 const maxPages=Math.max(1,Math.min(5,Number(process.env.RUGPRINT_MAX_SIGNATURE_PAGES||3))),txSample=Math.max(10,Math.min(60,Number(process.env.RUGPRINT_TX_SAMPLE||30)));
 const [meta,holders,sigs]=await Promise.all([getTokenMeta(mint),getHolderStats(mint),getSignatures(mint,maxPages)]);
 if(!sigs.length)throw new Error("No confirmed transactions were found for this address. Check the contract address and network.");
 const oldest=sigs.at(-1)!,oldestTx=await getTx(oldest.signature),creator=oldestTx?(signerWallets(oldestTx)[0]||null):null,evidence:Evidence[]=[],links:WalletLink[]=[],previousLaunches:CreatorLaunch[]=[];let parsedCount=oldestTx?1:0;
 if(creator)evidence.push({id:"creator",title:"Earliest observed signer",detail:`${creator} signed the oldest mint-address transaction found inside this scan window. This is a creator candidate, not proof of real-world identity.`,confidence:sigs.length<maxPages*500?"strong":"possible",tx:oldest.signature,wallet:creator});
 if(meta.mintAuthority)evidence.push({id:"mintauth",title:"Mint authority active",detail:`The token mint currently reports ${meta.mintAuthority} as mint authority.`,confidence:"confirmed",wallet:meta.mintAuthority});else evidence.push({id:"mintauth",title:"Mint authority revoked",detail:"The token mint currently has no mint authority.",confidence:"confirmed"});
 if(meta.freezeAuthority)evidence.push({id:"freezeauth",title:"Freeze authority active",detail:`The token mint currently reports ${meta.freezeAuthority} as freeze authority.`,confidence:"confirmed",wallet:meta.freezeAuthority});else evidence.push({id:"freezeauth",title:"Freeze authority revoked",detail:"The token mint currently has no freeze authority.",confidence:"confirmed"});
 if(holders.top10Pct!=null)evidence.push({id:"holders",title:"Holder concentration",detail:`The 10 largest token accounts hold ${holders.top10Pct.toFixed(2)}% of current supply. Token accounts may include pools, program vaults, or exchanges, so this is a concentration signal rather than proof of common ownership.`,confidence:"confirmed"});
 let fundingSource:string|null=null,fundingSignature:string|null=null;
 if(creator){const creatorSigs=(await getSignatures(creator,1)).slice(0,txSample),txs=await boundedMap(creatorSigs,3,async s=>{try{return await getTx(s.signature)}catch{return null}});parsedCount+=txs.filter(Boolean).length;const cutoff=oldest.blockTime??Number.MAX_SAFE_INTEGER,prior=txs.filter((tx):tx is ParsedTx=>Boolean(tx&&(tx.blockTime??0)<=cutoff));let best:any=null;for(const tx of prior)for(const t of parsedSystemTransfers(tx))if(t.to===creator&&t.from!==creator&&t.from!==SYSTEM_PROGRAM){const c={...t,blockTime:tx.blockTime};if(!best||(c.blockTime??0)>(best.blockTime??0))best=c;}if(best){fundingSource=best.from;fundingSignature=best.signature;const amount=best.lamports/LAMPORTS;links.push({from:best.from,to:creator,reason:`Funded creator candidate with ${amount.toFixed(4)} SOL before/around earliest observed mint activity`,confidence:"strong",tx:best.signature,amountSol:amount});evidence.push({id:"funding",title:"Pre-launch funding link",detail:`${best.from} transferred ${amount.toFixed(4)} SOL to the creator candidate before/around earliest observed mint activity.`,confidence:"strong",tx:best.signature,wallet:best.from});}
 const seen=new Map<string,number|null>();for(const tx of txs){if(!tx)continue;for(const c of parsedMintInitializations(tx))if(c!==mint)seen.set(c,tx.blockTime);for(const w of signerWallets(tx).filter(w=>w!==creator).slice(0,3))if(!links.some(l=>l.to===w||l.from===w))links.push({from:creator,to:w,reason:"Co-signed a transaction with the creator candidate",confidence:"possible",tx:tx.transaction.signatures[0]});}for(const [m,firstSeen] of [...seen.entries()].slice(0,20))previousLaunches.push({mint:m,firstSeen,evidence:"Mint initialisation appeared in sampled creator-wallet transaction history"});if(previousLaunches.length)evidence.push({id:"history",title:"Other mint initialisations",detail:`${previousLaunches.length} other token mint initialisation(s) appeared in sampled creator-wallet history. This does not by itself mean those tokens rugged.`,confidence:"strong",wallet:creator});}
 const risk=scoreRisk(meta,holders,links,previousLaunches),provider=process.env.HELIUS_API_KEY?.trim()?"helius":"solana-rpc",notes=["RugPrint reports observable relationships; it does not identify a real-world person from a wallet address.","Holder concentration can include AMM pools, exchange wallets and program-owned accounts.","RPC calls use bounded concurrency, short-lived caching and automatic retry/backoff."];
 if(sigs.length>=maxPages*500)notes.push("The mint hit the configured signature-page cap, so the earliest observed signer may not be the actual deployer.");if(!process.env.HELIUS_API_KEY?.trim())notes.push("No Helius key is configured. Public Solana RPC may rate-limit scans.");
 const scanId=createHash("sha256").update(`${mint}:${Date.now()}`).digest("hex").slice(0,12),basis=[creator?`creator:${creator}`:"creator:unknown",fundingSource?`funder:${fundingSource}`:"funder:unknown",...links.slice(0,8).map(l=>`link:${[l.from,l.to].sort().join(":")}:${l.confidence}`),`mintAuthority:${Boolean(meta.mintAuthority)}`,`freezeAuthority:${Boolean(meta.freezeAuthority)}`,`historyBucket:${Math.min(10,previousLaunches.length)}`].sort(),dna=createHash("sha256").update(basis.join("|")).digest("hex");
 return{scanId,generatedAt:new Date().toISOString(),network:"mainnet-beta",token:meta,fingerprint:{clusterId:`RP-${dna.slice(0,8).toUpperCase()}`,rugDna:dna.match(/.{1,4}/g)?.slice(0,6).join("-").toUpperCase()||dna.slice(0,24).toUpperCase(),basis},creator:{wallet:creator,creationSignature:oldest.signature,firstSeen:oldest.blockTime,fundingSource,fundingSignature},holders,links:links.slice(0,25),previousLaunches,evidence,risk,coverage:{provider,signaturesInspected:sigs.length,transactionsParsed:parsedCount,notes}};
}
