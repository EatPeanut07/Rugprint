import os, json, sqlite3, asyncio, time, re, hashlib, secrets, math
from datetime import datetime, timezone
from typing import Optional
import httpx
from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

APP_NAME = os.getenv("STUDIO_NAME","Autonomous Memecoin Studio")
DB = os.getenv("DB_PATH","studio_v5.db")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN","")
SIM_ONLY = os.getenv("SIMULATION_ONLY","true").lower()=="true"

DEX_ENABLED = os.getenv("DEXSCREENER_ENABLED","true").lower()=="true"
DEX_SCAN_SECONDS = max(60,int(os.getenv("DEX_SCAN_SECONDS","300")))
DEX_MIN_LIQUIDITY = float(os.getenv("DEX_MIN_LIQUIDITY_USD","10000"))
DEX_MIN_VOLUME = float(os.getenv("DEX_MIN_VOLUME_H24_USD","25000"))
DEX_MIN_TXNS = int(os.getenv("DEX_MIN_TXNS_H24","100"))

SOLANA_RPC_URL = os.getenv("SOLANA_RPC_URL","https://api.mainnet-beta.solana.com")
SOLANA_DISCOVERY_ENABLED = os.getenv("SOLANA_DISCOVERY_ENABLED","true").lower()=="true"
SOLANA_DISCOVERY_SECONDS = max(60,int(os.getenv("SOLANA_DISCOVERY_SECONDS","180")))
SOLANA_MAX_TOKENS_PER_SCAN = max(1,int(os.getenv("SOLANA_MAX_TOKENS_PER_SCAN","8")))
SOLANA_SIGNATURES_PER_TOKEN = max(5,min(50,int(os.getenv("SOLANA_SIGNATURES_PER_TOKEN","20"))))
SOLANA_MAX_TX_FETCHES_PER_SCAN = max(5,min(100,int(os.getenv("SOLANA_MAX_TX_FETCHES_PER_SCAN","40"))))
MIN_REPEAT_TOKENS_FOR_PATTERN = max(2,int(os.getenv("MIN_REPEAT_TOKENS_FOR_PATTERN","3")))

REDDIT_ENABLED = os.getenv("REDDIT_ENABLED","true").lower()=="true"
REDDIT_QUERIES = [q.strip() for q in os.getenv("REDDIT_QUERIES","solana memecoin|solana meme coin").split("|") if q.strip()]
REDDIT_SCAN_SECONDS = max(300,int(os.getenv("REDDIT_SCAN_SECONDS","900")))
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT","AutonomousMemecoinStudio/1.0")

TELEGRAM_ENABLED = os.getenv("TELEGRAM_ENABLED","false").lower()=="true"
TELEGRAM_API_ID = os.getenv("TELEGRAM_API_ID","")
TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH","")
TELEGRAM_SESSION = os.getenv("TELEGRAM_SESSION","")
TELEGRAM_CHANNELS = [x.strip() for x in os.getenv("TELEGRAM_CHANNELS","").split("|") if x.strip()]

X_ENABLED = os.getenv("X_ENABLED","false").lower()=="true"
X_BEARER_TOKEN = os.getenv("X_BEARER_TOKEN","")
X_SEARCH_QUERY = os.getenv("X_SEARCH_QUERY","(solana OR memecoin OR meme coin) -is:retweet lang:en")

BLACKLIST_MIN_SCORE = float(os.getenv("BLACKLIST_MIN_SCORE","85"))
MAX_FP_RISK = float(os.getenv("BLOCKLIST_MAX_FALSE_POSITIVE_RISK","20"))

app = FastAPI(title=APP_NAME,version="5.0")

def now(): return datetime.now(timezone.utc).isoformat()

def db():
    c=sqlite3.connect(DB,timeout=30)
    c.row_factory=sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA busy_timeout=5000")
    return c

def init():
    c=db()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS state(k TEXT PRIMARY KEY,v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS intelligence(
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, source TEXT, source_id TEXT, kind TEXT,
      title TEXT, body TEXT, url TEXT, token_address TEXT, score REAL,
      liquidity_usd REAL, volume_h24 REAL, buys_h24 INTEGER, sells_h24 INTEGER,
      market_cap REAL, raw TEXT, UNIQUE(source,source_id)
    );
    CREATE TABLE IF NOT EXISTS source_health(
      source TEXT PRIMARY KEY,last_ok TEXT,last_error TEXT,items_seen INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS discovered_tokens(
      token_address TEXT PRIMARY KEY, first_seen TEXT, last_seen TEXT, title TEXT, pair_address TEXT,
      dex_url TEXT, discovery_score REAL, last_signature_scan TEXT
    );
    CREATE TABLE IF NOT EXISTS token_transactions(
      signature TEXT PRIMARY KEY, ts TEXT, token_address TEXT, slot INTEGER, block_time INTEGER,
      fee_payer TEXT, signers TEXT, account_keys TEXT, err TEXT
    );
    CREATE TABLE IF NOT EXISTS wallet_token_history(
      wallet TEXT, token_address TEXT, first_seen TEXT, last_seen TEXT, tx_count INTEGER DEFAULT 0,
      signer_count INTEGER DEFAULT 0, fee_payer_count INTEGER DEFAULT 0,
      PRIMARY KEY(wallet,token_address)
    );
    CREATE TABLE IF NOT EXISTS wallet_edges(
      wallet_a TEXT, wallet_b TEXT, first_seen TEXT, last_seen TEXT, cooccurrences INTEGER DEFAULT 0,
      shared_tokens INTEGER DEFAULT 0, confidence REAL DEFAULT 0,
      PRIMARY KEY(wallet_a,wallet_b)
    );
    CREATE TABLE IF NOT EXISTS projects(
      id INTEGER PRIMARY KEY AUTOINCREMENT,ts TEXT,name TEXT,ticker TEXT,narrative TEXT,
      status TEXT,fake_mint TEXT,source_intelligence_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS wallets(
      wallet TEXT PRIMARY KEY,label TEXT,reputation_score REAL,impact_score REAL,
      cluster_confidence REAL,false_positive_risk REAL,blacklist_status TEXT,evidence TEXT,
      first_seen TEXT,last_seen TEXT,tokens_seen INTEGER DEFAULT 0,tx_seen INTEGER DEFAULT 0,
      signer_count INTEGER DEFAULT 0,fee_payer_count INTEGER DEFAULT 0,
      repeat_token_score REAL DEFAULT 0,cooccurrence_score REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS blacklist(
      wallet TEXT PRIMARY KEY,ts TEXT,reason TEXT,evidence TEXT,status TEXT,appeal_status TEXT
    );
    CREATE TABLE IF NOT EXISTS wallet_events(
      id INTEGER PRIMARY KEY AUTOINCREMENT,ts TEXT,wallet TEXT,signature TEXT,
      details TEXT, UNIQUE(wallet,signature)
    );
    CREATE TABLE IF NOT EXISTS social_queue(
      id INTEGER PRIMARY KEY AUTOINCREMENT,ts TEXT,platform TEXT,text TEXT,status TEXT
    );
    CREATE TABLE IF NOT EXISTS treasury_proposals(
      id INTEGER PRIMARY KEY AUTOINCREMENT,ts TEXT,kind TEXT,amount REAL,asset TEXT,
      destination TEXT,reason TEXT,status TEXT
    );
    CREATE TABLE IF NOT EXISTS audit(
      id INTEGER PRIMARY KEY AUTOINCREMENT,ts TEXT,agent TEXT,action TEXT,status TEXT,details TEXT
    );
    """)
    for k,v in {"kill_switch":"true","collector_started":"false","champion":"champion-1","generation":"1"}.items():
        c.execute("INSERT OR IGNORE INTO state(k,v) VALUES(?,?)",(k,v))
    # Non-destructive migration for users upgrading from V4 on the same database.
    existing={r[1] for r in c.execute("PRAGMA table_info(wallets)").fetchall()}
    for col,decl in [
      ("first_seen","TEXT"),("last_seen","TEXT"),("tokens_seen","INTEGER DEFAULT 0"),
      ("tx_seen","INTEGER DEFAULT 0"),("signer_count","INTEGER DEFAULT 0"),
      ("fee_payer_count","INTEGER DEFAULT 0"),("repeat_token_score","REAL DEFAULT 0"),
      ("cooccurrence_score","REAL DEFAULT 0")]:
        if col not in existing:
            c.execute(f"ALTER TABLE wallets ADD COLUMN {col} {decl}")
    c.commit(); c.close()
init()

def state(k,d=""):
    c=db(); r=c.execute("SELECT v FROM state WHERE k=?",(k,)).fetchone(); c.close()
    return r["v"] if r else d

def set_state(k,v):
    c=db(); c.execute("INSERT INTO state(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",(k,str(v))); c.commit(); c.close()

def audit(agent,action,status,details):
    c=db(); c.execute("INSERT INTO audit(ts,agent,action,status,details) VALUES(?,?,?,?,?)",
                     (now(),agent,action,status,json.dumps(details,ensure_ascii=False)[:5000])); c.commit(); c.close()

def health_ok(source,count=0):
    c=db(); c.execute("""INSERT INTO source_health(source,last_ok,last_error,items_seen) VALUES(?,?,NULL,?)
                         ON CONFLICT(source) DO UPDATE SET last_ok=excluded.last_ok,last_error=NULL,
                         items_seen=source_health.items_seen+excluded.items_seen""",(source,now(),count)); c.commit(); c.close()

def health_err(source,e):
    c=db(); c.execute("""INSERT INTO source_health(source,last_ok,last_error,items_seen) VALUES(?,NULL,?,0)
                         ON CONFLICT(source) DO UPDATE SET last_error=excluded.last_error""",(source,str(e)[:500])); c.commit(); c.close()

def safe(s): return str(s or "").replace("<"," ").replace(">"," ")[:5000]
def clamp(v): return max(0,min(100,float(v)))

def require_admin(tok):
    if not ADMIN_TOKEN or tok!=ADMIN_TOKEN: raise HTTPException(403,"Invalid admin token")

async def get_json(url,headers=None,params=None):
    async with httpx.AsyncClient(timeout=20,follow_redirects=True) as client:
        r=await client.get(url,headers=headers,params=params)
        r.raise_for_status()
        return r.json()

def save_intel(source,source_id,kind,title,body="",url="",token="",score=0,liq=0,vol=0,buys=0,sells=0,mc=0,raw=None):
    c=db(); before=c.total_changes
    c.execute("""INSERT OR IGNORE INTO intelligence
      (ts,source,source_id,kind,title,body,url,token_address,score,liquidity_usd,volume_h24,buys_h24,sells_h24,market_cap,raw)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
      (now(),source,str(source_id),kind,safe(title),safe(body),safe(url),token,score,liq,vol,buys,sells,mc,
       json.dumps(raw or {},ensure_ascii=False)[:15000]))
    added=c.total_changes>before
    if token:
        pair_addr=((raw or {}).get("pair") or {}).get("pairAddress") or ""
        c.execute("""INSERT INTO discovered_tokens(token_address,first_seen,last_seen,title,pair_address,dex_url,discovery_score,last_signature_scan)
                     VALUES(?,?,?,?,?,?,?,NULL)
                     ON CONFLICT(token_address) DO UPDATE SET last_seen=excluded.last_seen,title=excluded.title,
                     dex_url=excluded.dex_url,discovery_score=MAX(discovered_tokens.discovery_score,excluded.discovery_score)""",
                  (token,now(),now(),safe(title),pair_addr,safe(url),score))
    c.commit(); c.close()
    return added

def score_pair(pair):
    liq=float((pair.get("liquidity") or {}).get("usd") or 0)
    vol=float((pair.get("volume") or {}).get("h24") or 0)
    tx=(pair.get("txns") or {}).get("h24") or {}
    buys=int(tx.get("buys") or 0); sells=int(tx.get("sells") or 0)
    h1=float((pair.get("priceChange") or {}).get("h1") or 0)
    n=buys+sells
    buy_ratio=buys/n if n else .5
    velocity=clamp(25+min(35,vol/max(liq,1)*10)+min(20,n/20)+max(-15,min(20,h1/2)))
    sentiment=clamp(50+(buy_ratio-.5)*60)
    created=pair.get("pairCreatedAt") or 0
    age=(time.time()*1000-created)/60000 if created else 99999
    novelty=clamp(80-(age/1440)*10)
    score=clamp(velocity*.45+novelty*.35+sentiment*.20)
    mc=float(pair.get("marketCap") or pair.get("fdv") or 0)
    return score,liq,vol,buys,sells,mc

async def dex_scan():
    if not DEX_ENABLED: return 0
    count=0
    candidates={}
    endpoints=[
      ("profile","https://api.dexscreener.com/token-profiles/latest/v1"),
      ("profile_update","https://api.dexscreener.com/token-profiles/recent-updates/v1"),
      ("community_takeover","https://api.dexscreener.com/community-takeovers/latest/v1"),
      ("boost","https://api.dexscreener.com/token-boosts/latest/v1")
    ]
    for kind,url in endpoints:
        try:
            data=await get_json(url)
            if isinstance(data,dict): data=[data]
            for item in data or []:
                if item.get("chainId")=="solana" and item.get("tokenAddress"):
                    candidates[item["tokenAddress"]]=(kind,item)
            health_ok("dex_"+kind,len(data or []))
        except Exception as e:
            health_err("dex_"+kind,e)
    try:
        metas=await get_json("https://api.dexscreener.com/metas/trending/v1")
        for m in metas or []:
            h1=float((m.get("marketCapChange") or {}).get("h1") or 0)
            score=clamp(55+h1/2)
            if save_intel("dexscreener","meta:"+str(m.get("slug") or m.get("name")),"meta",
                          m.get("name") or "Trending meta",m.get("description") or "",
                          score=score,liq=float(m.get("liquidity") or 0),vol=float(m.get("volume") or 0),
                          mc=float(m.get("marketCap") or 0),raw=m):
                count+=1
        health_ok("dex_metas",len(metas or []))
    except Exception as e:
        health_err("dex_metas",e)
    for token,(kind,item) in list(candidates.items())[:30]:
        try:
            pairs=await get_json(f"https://api.dexscreener.com/token-pairs/v1/solana/{token}")
            pairs=[p for p in (pairs or []) if p.get("chainId")=="solana"]
            if not pairs: continue
            pairs.sort(key=lambda p:float((p.get("liquidity") or {}).get("usd") or 0),reverse=True)
            p=pairs[0]
            score,liq,vol,buys,sells,mc=score_pair(p)
            if liq<DEX_MIN_LIQUIDITY or vol<DEX_MIN_VOLUME or buys+sells<DEX_MIN_TXNS: continue
            base=p.get("baseToken") or {}
            if save_intel("dexscreener",f"{kind}:{token}",kind,
                          f'{base.get("name") or token} ({base.get("symbol") or "?"})',
                          item.get("description") or "",p.get("url") or "",token,score,liq,vol,buys,sells,mc,
                          {"profile":item,"pair":p}):
                count+=1
        except Exception as e:
            audit("Trend Scout","enrich","error",{"token":token,"error":str(e)[:300]})
    health_ok("dexscreener",count)
    return count

async def solana_rpc(method,params):
    async with httpx.AsyncClient(timeout=25) as client:
        r=await client.post(SOLANA_RPC_URL,json={"jsonrpc":"2.0","id":1,"method":method,"params":params})
        r.raise_for_status()
        body=r.json()
        if body.get("error"): raise RuntimeError(body["error"])
        return body.get("result")

def extract_tx_participants(tx):
    if not tx: return [],"",[],None,None
    tr=tx.get("transaction") or {}; msg=tr.get("message") or {}; keys=msg.get("accountKeys") or []
    clean=[]; signers=[]
    for k in keys:
        if isinstance(k,str): pub=k; signer=False
        else: pub=k.get("pubkey") or ""; signer=bool(k.get("signer"))
        if pub:
            clean.append(pub)
            if signer: signers.append(pub)
    return signers,(clean[0] if clean else ""),clean,tx.get("slot"),tx.get("blockTime")

def update_wallet_history(token,signers,fee_payer):
    wallets=set(signers)
    if fee_payer: wallets.add(fee_payer)
    wallets={w for w in wallets if w and w!=token}
    c=db(); ts=now()
    for w in wallets:
        is_signer=1 if w in signers else 0; is_fee=1 if w==fee_payer else 0
        c.execute("""INSERT INTO wallet_token_history(wallet,token_address,first_seen,last_seen,tx_count,signer_count,fee_payer_count)
                     VALUES(?,?,?,?,1,?,?)
                     ON CONFLICT(wallet,token_address) DO UPDATE SET last_seen=excluded.last_seen,
                     tx_count=wallet_token_history.tx_count+1,
                     signer_count=wallet_token_history.signer_count+excluded.signer_count,
                     fee_payer_count=wallet_token_history.fee_payer_count+excluded.fee_payer_count""",
                  (w,token,ts,ts,is_signer,is_fee))
        c.execute("""INSERT INTO wallets(wallet,label,reputation_score,impact_score,cluster_confidence,false_positive_risk,
                     blacklist_status,evidence,first_seen,last_seen,tokens_seen,tx_seen,signer_count,fee_payer_count,
                     repeat_token_score,cooccurrence_score)
                     VALUES(?, '',0,0,0,100,'not_blocked','{}',?,?,1,1,?,?,0,0)
                     ON CONFLICT(wallet) DO UPDATE SET last_seen=excluded.last_seen,
                     tx_seen=COALESCE(wallets.tx_seen,0)+1,
                     signer_count=COALESCE(wallets.signer_count,0)+excluded.signer_count,
                     fee_payer_count=COALESCE(wallets.fee_payer_count,0)+excluded.fee_payer_count""",
                  (w,ts,ts,is_signer,is_fee))
    ws=sorted(wallets)
    for i in range(len(ws)):
        for j in range(i+1,len(ws)):
            a,b=ws[i],ws[j]
            c.execute("""INSERT INTO wallet_edges(wallet_a,wallet_b,first_seen,last_seen,cooccurrences,shared_tokens,confidence)
                         VALUES(?,?,?,?,1,0,0)
                         ON CONFLICT(wallet_a,wallet_b) DO UPDATE SET last_seen=excluded.last_seen,
                         cooccurrences=wallet_edges.cooccurrences+1""",(a,b,ts,ts))
    c.commit(); c.close()

def recompute_wallet_scores():
    c=db(); wallets=[r["wallet"] for r in c.execute("SELECT wallet FROM wallets").fetchall()]
    for w in wallets:
        tokens=c.execute("SELECT token_address,tx_count FROM wallet_token_history WHERE wallet=?",(w,)).fetchall()
        token_count=len(tokens); tx_count=sum(r["tx_count"] for r in tokens)
        edges=c.execute("SELECT cooccurrences FROM wallet_edges WHERE wallet_a=? OR wallet_b=?",(w,w)).fetchall()
        max_co=max([r["cooccurrences"] for r in edges],default=0)
        repeat=clamp((token_count/max(MIN_REPEAT_TOKENS_FOR_PATTERN,1))*40)
        co=clamp(max_co*10); cluster=clamp(repeat*.55+co*.45)
        # This is a review signal only. Ordinary trading is never treated as wrongdoing.
        review=clamp(cluster*.55+min(30,math.log1p(tx_count)*6))
        fp=clamp(100-min(60,token_count*8)-min(25,max_co*5))
        c.execute("""UPDATE wallets SET tokens_seen=?,repeat_token_score=?,cooccurrence_score=?,cluster_confidence=?,
                     reputation_score=MAX(COALESCE(reputation_score,0),?),false_positive_risk=MIN(COALESCE(false_positive_risk,100),?)
                     WHERE wallet=?""",(token_count,repeat,co,cluster,review,fp,w))
    # Shared token counts / confidence for co-occurrence edges
    for e in c.execute("SELECT wallet_a,wallet_b,cooccurrences FROM wallet_edges").fetchall():
        shared=c.execute("""SELECT COUNT(*) n FROM wallet_token_history a JOIN wallet_token_history b
                            ON a.token_address=b.token_address WHERE a.wallet=? AND b.wallet=?""",
                         (e["wallet_a"],e["wallet_b"])).fetchone()["n"]
        conf=clamp(shared*18+e["cooccurrences"]*3)
        c.execute("UPDATE wallet_edges SET shared_tokens=?,confidence=? WHERE wallet_a=? AND wallet_b=?",
                  (shared,conf,e["wallet_a"],e["wallet_b"]))
    c.commit(); c.close()

async def autonomous_wallet_discovery():
    if not SOLANA_DISCOVERY_ENABLED: return {"tokens":0,"tx":0,"new_wallets":0}
    c=db(); tokens=[dict(r) for r in c.execute("""SELECT * FROM discovered_tokens
              ORDER BY discovery_score DESC,last_seen DESC LIMIT ?""",(SOLANA_MAX_TOKENS_PER_SCAN,)).fetchall()]
    before=c.execute("SELECT COUNT(*) n FROM wallets").fetchone()["n"]; c.close()
    fetched=0; newtx=0
    for tok in tokens:
        token=tok["token_address"]
        scan_address=tok.get("pair_address") or token
        try:
            sigs=await solana_rpc("getSignaturesForAddress",[scan_address,{"limit":SOLANA_SIGNATURES_PER_TOKEN,"commitment":"confirmed"}])
            for item in sigs or []:
                if fetched>=SOLANA_MAX_TX_FETCHES_PER_SCAN: break
                sig=item.get("signature")
                if not sig: continue
                c=db(); exists=c.execute("SELECT 1 FROM token_transactions WHERE signature=?",(sig,)).fetchone(); c.close()
                if exists: continue
                try:
                    tx=await solana_rpc("getTransaction",[sig,{"encoding":"jsonParsed","maxSupportedTransactionVersion":0,"commitment":"confirmed"}])
                    fetched+=1
                    if not tx: continue
                    signers,fee_payer,keys,slot,block_time=extract_tx_participants(tx)
                    c=db(); before_tx=c.total_changes
                    c.execute("""INSERT OR IGNORE INTO token_transactions(signature,ts,token_address,slot,block_time,fee_payer,signers,account_keys,err)
                                 VALUES(?,?,?,?,?,?,?,?,?)""",
                              (sig,now(),token,slot,block_time,fee_payer,json.dumps(signers),json.dumps(keys),
                               json.dumps((tx.get("meta") or {}).get("err"))))
                    added=c.total_changes>before_tx; c.commit(); c.close()
                    if added:
                        newtx+=1; update_wallet_history(token,signers,fee_payer)
                except Exception as e:
                    audit("Wallet Discovery Agent","tx_fetch","error",{"signature":sig,"error":str(e)[:300]})
            c=db(); c.execute("UPDATE discovered_tokens SET last_signature_scan=? WHERE token_address=?",(now(),token)); c.commit(); c.close()
        except Exception as e:
            health_err("solana_wallet_discovery",e)
    recompute_wallet_scores()
    c=db(); after=c.execute("SELECT COUNT(*) n FROM wallets").fetchone()["n"]; c.close()
    result={"tokens":len(tokens),"tx":newtx,"new_wallets":max(0,after-before)}
    health_ok("solana_wallet_discovery",newtx)
    if newtx: audit("Wallet Discovery Agent","scan","ok",result)
    return result

async def reddit_scan():
    if not REDDIT_ENABLED: return 0
    count=0
    for q in REDDIT_QUERIES[:5]:
        try:
            data=await get_json("https://www.reddit.com/search.json",
                                headers={"User-Agent":REDDIT_USER_AGENT},
                                params={"q":q,"sort":"new","limit":15,"t":"day"})
            children=((data.get("data") or {}).get("children") or [])
            for child in children:
                d=child.get("data") or {}; title=d.get("title") or ""; body=d.get("selftext") or ""
                score=clamp(50+min(25,float(d.get("score") or 0)/5)+min(20,float(d.get("num_comments") or 0)/3))
                if save_intel("reddit",d.get("id"),"social",title,body,
                              "https://www.reddit.com"+(d.get("permalink") or ""),score=score,raw=d): count+=1
            health_ok("reddit",len(children))
        except Exception as e: health_err("reddit",e)
    return count

async def telegram_listener():
    if not (TELEGRAM_ENABLED and TELEGRAM_API_ID and TELEGRAM_API_HASH and TELEGRAM_SESSION and TELEGRAM_CHANNELS): return
    try:
        from telethon import TelegramClient, events
        from telethon.sessions import StringSession
        client=TelegramClient(StringSession(TELEGRAM_SESSION),int(TELEGRAM_API_ID),TELEGRAM_API_HASH)
        await client.start()
        @client.on(events.NewMessage)
        async def handler(event):
            try:
                chat=await event.get_chat(); title=getattr(chat,"title","") or getattr(chat,"username","") or ""
                if title not in TELEGRAM_CHANNELS: return
                text=event.raw_text or ""
                if any(x in text.lower() for x in ["seed phrase","private key","ignore previous instructions","admin token"]):
                    audit("Telegram Intelligence","blocked_input","blocked",{"channel":title}); return
                save_intel("telegram",f"{title}:{event.id}","social",text[:100],text,score=55,raw={"channel":title,"message_id":event.id})
            except Exception as e: audit("Telegram Intelligence","message","error",{"error":str(e)[:300]})
        health_ok("telegram",0)
        await client.run_until_disconnected()
    except Exception as e: health_err("telegram",e)

async def x_scan():
    if not (X_ENABLED and X_BEARER_TOKEN): return 0
    try:
        data=await get_json("https://api.x.com/2/tweets/search/recent",
            headers={"Authorization":f"Bearer {X_BEARER_TOKEN}"},
            params={"query":X_SEARCH_QUERY,"max_results":10,"tweet.fields":"public_metrics,created_at"})
        count=0
        for t in data.get("data",[]) or []:
            pm=t.get("public_metrics") or {}
            engagement=sum(int(pm.get(k) or 0) for k in ["like_count","retweet_count","reply_count","quote_count"])
            score=clamp(50+engagement/5)
            if save_intel("x",t.get("id"),"social",(t.get("text") or "")[:100],t.get("text") or "",score=score,raw=t):
                count+=1
        health_ok("x",count)
        return count
    except Exception as e:
        health_err("x",e)
        return 0

async def collector():
    set_state("collector_started","true")
    last_dex=last_sol=last_x=last_reddit=0
    while True:
        t=time.time()
        try:
            if DEX_ENABLED and t-last_dex>=DEX_SCAN_SECONDS:
                await dex_scan(); last_dex=t
            if SOLANA_DISCOVERY_ENABLED and t-last_sol>=SOLANA_DISCOVERY_SECONDS:
                await autonomous_wallet_discovery(); last_sol=t
            if REDDIT_ENABLED and t-last_reddit>=REDDIT_SCAN_SECONDS:
                await reddit_scan(); last_reddit=t
            if X_ENABLED and t-last_x>=900:
                await x_scan(); last_x=t
        except Exception as e:
            audit("Supervisor","collector","error",{"error":str(e)[:500]})
        await asyncio.sleep(15)

@app.on_event("startup")
async def startup():
    asyncio.create_task(collector())
    if TELEGRAM_ENABLED:
        asyncio.create_task(telegram_listener())

class WalletEvidence(BaseModel):
    wallet:str
    label:str=""
    repeat_dump_pattern:float=Field(0,ge=0,le=100)
    coordinated_launch_pattern:float=Field(0,ge=0,le=100)
    funding_cluster_match:float=Field(0,ge=0,le=100)
    linked_insider_pattern:float=Field(0,ge=0,le=100)
    panic_impact:float=Field(0,ge=0,le=100)
    false_positive_risk:float=Field(50,ge=0,le=100)
    evidence_notes:str=""

class ProjectReq(BaseModel):
    intelligence_id:int

class SocialDraft(BaseModel):
    platform:str
    text:str

class TreasuryProposal(BaseModel):
    kind:str
    amount:float=Field(0,ge=0)
    asset:str="SOL"
    destination:str=""
    reason:str=""

@app.post("/intelligence/scan-now")
async def scan_now(x_admin_token:Optional[str]=Header(None)):
    require_admin(x_admin_token)
    return {"dex_new":await dex_scan(),"wallet_discovery":await autonomous_wallet_discovery(),"reddit_new":await reddit_scan(),"x_new":await x_scan()}

@app.post("/project")
def project(r:ProjectReq):
    c=db(); i=c.execute("SELECT * FROM intelligence WHERE id=?",(r.intelligence_id,)).fetchone()
    if not i: c.close(); raise HTTPException(404,"Intelligence item not found")
    if i["score"]<70: c.close(); raise HTTPException(400,"Signal below threshold")
    words=re.findall(r"[A-Za-z0-9]+",i["title"]) or ["Trend"]
    name=" ".join(words[:3])[:28]; ticker=("".join(w[0] for w in words[:5]) or "MEME").upper()[:8]
    narrative=f"AI-operated cultural experiment inspired by {i['title']}. No guaranteed returns."
    cur=c.execute("INSERT INTO projects(ts,name,ticker,narrative,status,fake_mint,source_intelligence_id) VALUES(?,?,?,?,?,?,?)",
                  (now(),name,ticker,narrative,"draft",None,r.intelligence_id))
    pid=cur.lastrowid; c.commit(); c.close()
    audit("Creator Agent","create_project","ok",{"project_id":pid})
    return {"project_id":pid,"name":name,"ticker":ticker}

@app.post("/project/{pid}/simulate-launch")
def simulate_launch(pid:int):
    c=db(); p=c.execute("SELECT * FROM projects WHERE id=?",(pid,)).fetchone()
    if not p: c.close(); raise HTTPException(404,"Project not found")
    fake="SIM"+secrets.token_urlsafe(18).replace("-","").replace("_","")
    c.execute("UPDATE projects SET status='simulated_live',fake_mint=? WHERE id=?",(fake,pid)); c.commit(); c.close()
    return {"status":"simulated_live","fake_mint":fake,"real_chain_action":False}

@app.post("/wallet/evidence")
def wallet_evidence(w:WalletEvidence):
    score=(w.repeat_dump_pattern*.30+w.coordinated_launch_pattern*.25+w.funding_cluster_match*.20+
           w.linked_insider_pattern*.15+w.panic_impact*.10)
    cluster=max(w.funding_cluster_match,w.linked_insider_pattern)
    c=db()
    c.execute("""INSERT INTO wallets(wallet,label,reputation_score,impact_score,cluster_confidence,false_positive_risk,blacklist_status,evidence)
                 VALUES(?,?,?,?,?,?,?,?)
                 ON CONFLICT(wallet) DO UPDATE SET label=excluded.label,reputation_score=excluded.reputation_score,
                 impact_score=excluded.impact_score,cluster_confidence=excluded.cluster_confidence,
                 false_positive_risk=excluded.false_positive_risk,evidence=excluded.evidence""",
              (w.wallet,safe(w.label),score,w.panic_impact,cluster,w.false_positive_risk,"not_blocked",
               json.dumps(w.model_dump(),ensure_ascii=False)))
    c.commit(); c.close()
    return {"wallet":w.wallet,"reputation_score":round(score,2)}

@app.post("/wallet/{wallet}/evaluate-block")
def evaluate_block(wallet:str,x_admin_token:Optional[str]=Header(None)):
    require_admin(x_admin_token)
    c=db(); w=c.execute("SELECT * FROM wallets WHERE wallet=?",(wallet,)).fetchone()
    if not w: c.close(); raise HTTPException(404,"Wallet not found")
    if not (w["reputation_score"]>=BLACKLIST_MIN_SCORE and w["false_positive_risk"]<=MAX_FP_RISK):
        c.close(); raise HTTPException(400,"Evidence threshold not met")
    if not w["evidence"] or w["evidence"] in ("{}","null"):
        c.close(); raise HTTPException(400,"Automated pattern score requires corroborating documented evidence before restriction")
    reason=f"High-confidence harmful-pattern score {w['reputation_score']:.1f}; false-positive risk {w['false_positive_risk']:.1f}"
    c.execute("""INSERT INTO blacklist(wallet,ts,reason,evidence,status,appeal_status) VALUES(?,?,?,?,?,?)
                 ON CONFLICT(wallet) DO UPDATE SET ts=excluded.ts,reason=excluded.reason,evidence=excluded.evidence,status='active'""",
              (wallet,now(),reason,w["evidence"],"active","none"))
    c.execute("UPDATE wallets SET blacklist_status='blocked' WHERE wallet=?",(wallet,))
    c.commit(); c.close()
    return {"wallet":wallet,"status":"blocked","on_chain_enforcement":False}

@app.post("/social/draft")
def social_draft(s:SocialDraft):
    banned=["guaranteed profit","risk free","pump it","coordinate buys","everyone buy now","can't lose"]
    if any(x in s.text.lower() for x in banned):
        raise HTTPException(400,"Manipulative/deceptive claim rejected")
    c=db(); cur=c.execute("INSERT INTO social_queue(ts,platform,text,status) VALUES(?,?,?,?)",
                         (now(),safe(s.platform),safe(s.text),"draft"))
    sid=cur.lastrowid; c.commit(); c.close()
    return {"id":sid,"status":"draft"}

@app.post("/treasury/propose")
def treasury(t:TreasuryProposal):
    status="blocked" if state("kill_switch","true")=="true" else "proposal_only"
    c=db(); cur=c.execute("INSERT INTO treasury_proposals(ts,kind,amount,asset,destination,reason,status) VALUES(?,?,?,?,?,?,?)",
                         (now(),safe(t.kind),t.amount,safe(t.asset),safe(t.destination),safe(t.reason),status))
    tid=cur.lastrowid; c.commit(); c.close()
    return {"proposal_id":tid,"status":status,"executed":False}

@app.get("/api/status")
def status():
    c=db()
    counts={t:c.execute(f"SELECT COUNT(*) n FROM {t}").fetchone()["n"] for t in
            ["intelligence","discovered_tokens","token_transactions","projects","wallets","wallet_edges","blacklist","social_queue"]}
    health=[dict(r) for r in c.execute("SELECT * FROM source_health ORDER BY source").fetchall()]
    c.close()
    return {"version":"5.0","mode":"SIMULATION_ONLY" if SIM_ONLY else "PARTIAL_LIVE",
            "collector_running":state("collector_started","false"),
            "dexscreener_enabled":DEX_ENABLED,
            "x_enabled":X_ENABLED and bool(X_BEARER_TOKEN),
            "autonomous_wallet_discovery":SOLANA_DISCOVERY_ENABLED,
      "reddit_enabled":REDDIT_ENABLED,
      "telegram_enabled":TELEGRAM_ENABLED and bool(TELEGRAM_SESSION),
            "counts":counts,"sources":health}

@app.get("/",response_class=HTMLResponse)
def dash():
    c=db()
    intel=c.execute("SELECT * FROM intelligence ORDER BY score DESC,id DESC LIMIT 20").fetchall()
    health=c.execute("SELECT * FROM source_health ORDER BY source").fetchall()
    wallets=c.execute("SELECT * FROM wallets ORDER BY tokens_seen DESC,cluster_confidence DESC,tx_seen DESC LIMIT 20").fetchall()
    tokens=c.execute("SELECT * FROM discovered_tokens ORDER BY discovery_score DESC,last_seen DESC LIMIT 15").fetchall()
    edges=c.execute("SELECT * FROM wallet_edges ORDER BY confidence DESC,cooccurrences DESC LIMIT 15").fetchall()
    projects=c.execute("SELECT * FROM projects ORDER BY id DESC LIMIT 10").fetchall()
    c.close()
    def rows(items,fields):
        if not items:return "<tr><td>No data yet</td></tr>"
        return "".join("<tr>"+"".join(f"<td>{safe(r[f])[:100]}</td>" for f in fields)+"</tr>" for r in items)
    return f"""<html><head><meta name='viewport' content='width=device-width,initial-scale=1'>
    <style>body{{font-family:system-ui;background:#080d18;color:#eef3ff;padding:18px}}
    .grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}}
    .card{{background:#121a2b;border:1px solid #293450;border-radius:15px;padding:14px;margin-bottom:12px;overflow:auto}}
    table{{width:100%;border-collapse:collapse;font-size:12px}}td,th{{padding:7px;border-bottom:1px solid #293450;text-align:left;white-space:nowrap}}</style>
    </head><body><h1>🤖 {APP_NAME} V5</h1><p>LIVE INTELLIGENCE · AUTONOMOUS WALLET DISCOVERY · SIMULATED FINANCE</p>
    <div class='grid'>
      <div class='card'><h3>📡 DEX Scout</h3><p>{"ON" if DEX_ENABLED else "OFF"}</p></div>
      <div class='card'><h3>🧠 Wallet Discovery</h3><p>{"ON" if SOLANA_DISCOVERY_ENABLED else "OFF"}</p><small>No manual wallet list required.</small></div>
      <div class='card'><h3>💬 Reddit</h3><p>{"ON" if REDDIT_ENABLED else "OFF"}</p></div>
      <div class='card'><h3>𝕏 X Intelligence</h3><p>{"ON" if X_ENABLED and X_BEARER_TOKEN else "READY"}</p></div>
      <div class='card'><h3>✈️ Telegram</h3><p>{"ON" if TELEGRAM_ENABLED and TELEGRAM_SESSION else "READY"}</p></div>
      <div class='card'><h3>🛡️ Firewall</h3><p>Evidence-based</p></div>
      <div class='card'><h3>🔐 Finance</h3><p>NO SIGNER</p></div>
      <div class='card'><h3>🚨 Kill Switch</h3><p>{state("kill_switch","true").upper()}</p></div>
    </div>
    <div class='card'><h3>🔥 Real Intelligence</h3><table>{rows(intel,["score","source","kind","title","liquidity_usd","volume_h24","token_address"])}</table></div>
    <div class='card'><h3>🪙 Auto-Discovered Tokens</h3><table>{rows(tokens,["discovery_score","title","token_address","last_signature_scan"])}</table></div>
    <div class='card'><h3>👛 Auto-Discovered Wallets</h3><table>{rows(wallets,["wallet","tokens_seen","tx_seen","repeat_token_score","cluster_confidence","reputation_score","false_positive_risk"])}</table></div>
    <div class='card'><h3>🕸️ Wallet Co-occurrence</h3><table>{rows(edges,["wallet_a","wallet_b","shared_tokens","cooccurrences","confidence"])}</table></div>
    <div class='card'><h3>📡 Source Health</h3><table>{rows(health,["source","last_ok","last_error","items_seen"])}</table></div>
    <div class='card'><h3>Projects</h3><table>{rows(projects,["id","name","ticker","status"])}</table></div>
    </body></html>"""
