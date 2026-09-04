"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Confidence, ScanResult } from "@/lib/types";

const short = (v?: string | null, n = 6) => !v ? "Unknown" : `${v.slice(0, n)}…${v.slice(-n)}`;
const when = (v?: number | null) => !v ? "Unknown" : new Date(v * 1000).toLocaleString();

function badge(c: Confidence) {
  return <span className={`badge ${c}`}>{c}</span>;
}

function explorer(kind: "address" | "tx", value: string) {
  return `https://solscan.io/${kind === "tx" ? "tx" : "account"}/${value}`;
}

export default function Scanner() {
  const [mint, setMint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ScanResult | null>(null);
  const [tab, setTab] = useState<"evidence" | "graph" | "early" | "history" | "notebook">("evidence");
  const [aliases, setAliases] = useState("");
  const [claims, setClaims] = useState("");
  const [sources, setSources] = useState("");

  const riskClass = data?.risk.label.toLowerCase();
  const report = useMemo(() => {
    if (!data) return "";
    const score = data.risk.score == null ? "UNRESOLVED" : `${data.risk.score}/100 ${data.risk.label}`;
    const lines = [
      `# RugPrint report ${data.scanId}`,
      `Token: ${data.token.name || "Unknown"} ${data.token.symbol ? `(${data.token.symbol})` : ""}`,
      `Mint: ${data.token.mint}`,
      `Launch platform: ${data.launch.platform}`,
      `Creator risk: ${score}`,
      `Data confidence: ${data.risk.dataConfidence}%`,
      `Creator cluster: ${data.fingerprint.clusterId}`,
      `Rug DNA: ${data.fingerprint.rugDna}`,
      `Creator candidate: ${data.creator.wallet || "Unknown"}`,
      `Funding source: ${data.creator.fundingSource || "Unknown"}`,
      `Top 10 concentration: ${data.holders.top10Pct?.toFixed(2) ?? "Unknown"}%`,
      `Early wallets sampled: ${data.earlyWallets.length}`,
      "",
      "Risk reasons:", ...data.risk.reasons.map(r => `- ${r}`),
      "",
      "Unknown / incomplete:", ...(data.risk.unknowns.length ? data.risk.unknowns.map(r => `- ${r}`) : ["- None flagged"]),
      "",
      "Evidence:", ...data.evidence.map(e => `- [${e.confidence}] ${e.title}: ${e.detail}`),
      "",
      "Analyst notebook (user-supplied, not independently verified):",
      `Aliases: ${aliases || "None"}`,
      `Claims: ${claims || "None"}`,
      `Sources: ${sources || "None"}`,
      "",
      "RugPrint reports blockchain relationships, not legal conclusions or real-world identity."
    ];
    return lines.join("\n");
  }, [data, aliases, claims, sources]);

  async function scan(e: FormEvent) {
    e.preventDefault();
    setError(""); setData(null); setLoading(true);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mint: mint.trim() }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Scan failed");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally { setLoading(false); }
  }

  function download() {
    if (!data) return;
    const blob = new Blob([report], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rugprint-${data.token.symbol || data.token.mint.slice(0,8)}-${data.scanId}.md`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  return <>
    <form className="scanbox" onSubmit={scan}>
      <div className="inputrow">
        <span className="networkdot" />
        <input aria-label="Solana contract address" value={mint} onChange={e => setMint(e.target.value)} placeholder="Paste Solana contract address…" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <button disabled={loading || !mint.trim()}>{loading ? <><span className="spinner"/>Tracing</> : "Trace token"}</button>
      </div>
      <p>Creator-first analysis. No wallet connection required. No trading. No private keys.</p>
    </form>

    {error && <div className="error"><strong>Scan failed.</strong> {error}</div>}
    {loading && <div className="loadingpanel"><div className="radar"><i/><i/><i/></div><div><strong>Building the footprint…</strong><span>Resolving launch transaction, funding provenance, early wallets, creator history and concentration.</span></div></div>}

    {data && <section className="report">
      <div className="reporthead">
        <div className="tokenid">
          <div className="tokenmark">{data.token.symbol?.slice(0,2) || "RP"}</div>
          <div><div className="eyebrow">RUGPRINT / {data.scanId}</div><h2>{data.token.name || "Unknown token"} <span>{data.token.symbol || ""}</span></h2><a href={explorer("address", data.token.mint)} target="_blank">{short(data.token.mint, 8)} ↗</a></div>
        </div>
        <div className={`risk ${riskClass}`}>
          <span>CREATOR RISK</span>
          {data.risk.score == null ? <strong className="unresolvedword">?</strong> : <><strong>{data.risk.score}</strong><em>/100</em></>}
          <b>{data.risk.label}</b>
          <small>{data.risk.dataConfidence}% data confidence</small>
        </div>
      </div>

      {data.risk.label === "UNRESOLVED" && <div className="unresolvedcallout"><b>⚠ Risk unresolved</b><span>RugPrint does not have enough creator intelligence to call this token low risk. Unknown is not the same as safe.</span></div>}

      <div className="metrics">
        <article><span>Creator candidate</span><strong>{short(data.creator.wallet)}</strong><small>{data.creator.wallet ? <a href={explorer("address", data.creator.wallet)} target="_blank">Open wallet ↗</a> : "Not resolved"}</small></article>
        <article><span>Funding source</span><strong>{short(data.creator.fundingSource)}</strong><small>{data.creator.fundingSource ? <a href={explorer("address", data.creator.fundingSource)} target="_blank">Open wallet ↗</a> : "Not resolved"}</small></article>
        <article><span>Launch footprint</span><strong>{data.launch.platform}</strong><small>{data.launch.creationConfidence} attribution</small></article>
        <article><span>Rug DNA cluster</span><strong>{data.fingerprint.clusterId}</strong><small title={data.fingerprint.rugDna}>{data.fingerprint.rugDna.slice(0,14)}…</small></article>
      </div>

      <div className="reasonstrip">{data.risk.reasons.map((r,i)=><span key={i}>⚠ {r}</span>)}</div>
      {!!data.risk.unknowns.length && <div className="unknownstrip"><b>Still unknown:</b>{data.risk.unknowns.map((r,i)=><span key={i}>? {r}</span>)}</div>}

      <nav className="tabs">
        {(["evidence","graph","early","history","notebook"] as const).map(t=><button type="button" key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t === "graph" ? "Wallet links" : t === "early" ? "Early wallets" : t === "notebook" ? "Social evidence" : t[0].toUpperCase()+t.slice(1)}</button>)}
        <button type="button" className="export" onClick={download}>Export report ↓</button>
      </nav>

      {tab === "evidence" && <div className="evidencegrid">
        {data.evidence.map(e=><article className="evidence" key={e.id}><header>{badge(e.confidence)}<span>{e.title}</span></header><p>{e.detail}</p><footer>{e.wallet && <a href={explorer("address",e.wallet)} target="_blank">wallet {short(e.wallet)} ↗</a>}{e.tx && <a href={explorer("tx",e.tx)} target="_blank">transaction ↗</a>}</footer></article>)}
      </div>}

      {tab === "graph" && <div className="linklist">
        <div className="graphhero"><div className="node source">FUNDER<br/><b>{short(data.creator.fundingSource,4)}</b></div><div className="line">→</div><div className="node creator">CREATOR CANDIDATE<br/><b>{short(data.creator.wallet,4)}</b></div><div className="line">→</div><div className="node token">TOKEN<br/><b>{data.token.symbol || short(data.token.mint,4)}</b></div></div>
        {data.links.length ? data.links.map((l,i)=><article key={`${l.tx}-${i}`}><div><b>{short(l.from)}</b><span>→</span><b>{short(l.to)}</b></div><p>{l.reason}</p><aside>{badge(l.confidence)}{l.tx && <a href={explorer("tx",l.tx)} target="_blank">proof ↗</a>}</aside></article>) : <div className="empty">No additional wallet relationships were resolved in this scan.</div>}
      </div>}

      {tab === "early" && <div className="history">
        {data.earlyWallets.length ? data.earlyWallets.map((w,i)=><article key={w.wallet}><span>{String(i+1).padStart(2,"0")}</span><div><strong>{short(w.wallet,8)}</strong><p>Observed early token inflow: {w.tokenDelta == null ? "Unknown" : Math.round(w.tokenDelta).toLocaleString()} tokens</p><small>{w.sharedCreatorFunder ? "⚠ Shares creator funding source" : w.fundingSource ? `Funder ${short(w.fundingSource)}` : "Funding source unresolved"}</small></div><a href={explorer("tx",w.signature)} target="_blank">Evidence ↗</a></article>) : <div className="empty">No early wallets were resolved from the bounded launch window.</div>}
      </div>}

      {tab === "history" && <div className="history">
        {data.previousLaunches.length ? data.previousLaunches.map((h,i)=><article key={h.mint}><span>{String(i+1).padStart(2,"0")}</span><div><strong>{short(h.mint,8)}</strong><p>{h.evidence}</p><small>{when(h.firstSeen)}</small></div><a href={explorer("address",h.mint)} target="_blank">Inspect ↗</a></article>) : <div className="empty">No other mint initialisations were found in the sampled creator history. That is not proof this creator has no other launches.</div>}
      </div>}

      {tab === "notebook" && <div className="notebook">
        <div className="notewarning"><b>Public evidence notebook</b><p>Use this to preserve a handle, historical alias, public claim and source URL. RugPrint keeps social evidence separate from on-chain attribution. A token linking somebody&apos;s X post is not proof that person controlled the launch.</p></div>
        <label>Known / historical public handles<textarea value={aliases} onChange={e=>setAliases(e.target.value)} placeholder="Example: @oldhandle → @newhandle, date/context…" /></label>
        <label>Public claims to compare with chain evidence<textarea value={claims} onChange={e=>setClaims(e.target.value)} placeholder="Example: ‘Dev never sold’ — exact claim/date…" /></label>
        <label>Source URLs / archived evidence<textarea value={sources} onChange={e=>setSources(e.target.value)} placeholder="Paste public source links here…" /></label>
        <p className="tiny">These notes remain in this browser session and are included in the exported report. Automatic historical X attribution is intentionally not claimed without a reliable data source.</p>
      </div>}

      <div className="coverage"><div><span>Provider</span><b>{data.coverage.provider}</b></div><div><span>Mint signatures</span><b>{data.coverage.signaturesInspected.toLocaleString()}</b></div><div><span>Creator signatures</span><b>{data.coverage.creatorSignaturesInspected.toLocaleString()}</b></div><div><span>Transactions parsed</span><b>{data.coverage.transactionsParsed}</b></div></div>
      <details><summary>Coverage limits & interpretation</summary>{data.coverage.notes.map((n,i)=><p key={i}>{n}</p>)}</details>
    </section>}
  </>;
}
