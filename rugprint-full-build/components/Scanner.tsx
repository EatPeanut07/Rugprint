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
  const [tab, setTab] = useState<"evidence" | "graph" | "history" | "notebook">("evidence");
  const [aliases, setAliases] = useState("");
  const [claims, setClaims] = useState("");

  const riskClass = data?.risk.label.toLowerCase();
  const report = useMemo(() => {
    if (!data) return "";
    const lines = [
      `# RugPrint report ${data.scanId}`,
      `Token: ${data.token.name || "Unknown"} ${data.token.symbol ? `(${data.token.symbol})` : ""}`,
      `Mint: ${data.token.mint}`,
      `Risk: ${data.risk.score}/100 ${data.risk.label}`,
      `Creator cluster: ${data.fingerprint.clusterId}`,
      `Rug DNA: ${data.fingerprint.rugDna}`,
      `Creator candidate: ${data.creator.wallet || "Unknown"}`,
      `Funding source: ${data.creator.fundingSource || "Unknown"}`,
      `Top 10 concentration: ${data.holders.top10Pct?.toFixed(2) ?? "Unknown"}%`,
      "",
      "Risk reasons:", ...data.risk.reasons.map(r => `- ${r}`),
      "",
      "Evidence:", ...data.evidence.map(e => `- [${e.confidence}] ${e.title}: ${e.detail}`),
      "",
      "Analyst notebook (user-supplied, not independently verified):",
      `Aliases: ${aliases || "None"}`,
      `Claims: ${claims || "None"}`,
      "",
      "RugPrint reports blockchain relationships, not legal conclusions or real-world identity."
    ];
    return lines.join("\n");
  }, [data, aliases, claims]);

  async function scan(e: FormEvent) {
    e.preventDefault();
    setError(""); setData(null); setLoading(true);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mint }) });
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
      <p>Evidence-first analysis. No wallet connection required. No trading. No private keys.</p>
    </form>

    {error && <div className="error"><strong>Scan failed.</strong> {error}</div>}
    {loading && <div className="loadingpanel"><div className="radar"><i/><i/><i/></div><div><strong>Building the footprint…</strong><span>Reading mint state, holder concentration, transaction history and wallet relationships.</span></div></div>}

    {data && <section className="report">
      <div className="reporthead">
        <div className="tokenid">
          <div className="tokenmark">{data.token.symbol?.slice(0,2) || "RP"}</div>
          <div><div className="eyebrow">RUGPRINT / {data.scanId}</div><h2>{data.token.name || "Unknown token"} <span>{data.token.symbol || ""}</span></h2><a href={explorer("address", data.token.mint)} target="_blank">{short(data.token.mint, 8)} ↗</a></div>
        </div>
        <div className={`risk ${riskClass}`}><span>RISK</span><strong>{data.risk.score}</strong><em>/100</em><b>{data.risk.label}</b></div>
      </div>

      <div className="metrics">
        <article><span>Creator candidate</span><strong>{short(data.creator.wallet)}</strong><small>{data.creator.wallet ? <a href={explorer("address", data.creator.wallet)} target="_blank">Open wallet ↗</a> : "Not resolved"}</small></article>
        <article><span>Funding source</span><strong>{short(data.creator.fundingSource)}</strong><small>{data.creator.fundingSource ? <a href={explorer("address", data.creator.fundingSource)} target="_blank">Open wallet ↗</a> : "No pre-launch transfer found"}</small></article>
        <article><span>Top 10 concentration</span><strong>{data.holders.top10Pct?.toFixed(1) ?? "?"}%</strong><small>{data.holders.accountsChecked} largest accounts sampled</small></article>
        <article><span>Rug DNA cluster</span><strong>{data.fingerprint.clusterId}</strong><small title={data.fingerprint.rugDna}>{data.fingerprint.rugDna.slice(0,14)}…</small></article>
      </div>

      <div className="reasonstrip">{data.risk.reasons.map((r,i)=><span key={i}>⚠ {r}</span>)}</div>

      <nav className="tabs">
        {(["evidence","graph","history","notebook"] as const).map(t=><button type="button" key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t === "graph" ? "Wallet links" : t === "notebook" ? "Social notebook" : t[0].toUpperCase()+t.slice(1)}</button>)}
        <button type="button" className="export" onClick={download}>Export report ↓</button>
      </nav>

      {tab === "evidence" && <div className="evidencegrid">
        {data.evidence.map(e=><article className="evidence" key={e.id}><header>{badge(e.confidence)}<span>{e.title}</span></header><p>{e.detail}</p><footer>{e.wallet && <a href={explorer("address",e.wallet)} target="_blank">wallet {short(e.wallet)} ↗</a>}{e.tx && <a href={explorer("tx",e.tx)} target="_blank">transaction ↗</a>}</footer></article>)}
      </div>}

      {tab === "graph" && <div className="linklist">
        <div className="graphhero"><div className="node source">FUNDING<br/><b>{short(data.creator.fundingSource,4)}</b></div><div className="line">→</div><div className="node creator">CREATOR CANDIDATE<br/><b>{short(data.creator.wallet,4)}</b></div><div className="line">→</div><div className="node token">TOKEN<br/><b>{data.token.symbol || short(data.token.mint,4)}</b></div></div>
        {data.links.length ? data.links.map((l,i)=><article key={i}><div><b>{short(l.from)}</b><span>→</span><b>{short(l.to)}</b></div><p>{l.reason}</p><aside>{badge(l.confidence)}{l.tx && <a href={explorer("tx",l.tx)} target="_blank">proof ↗</a>}</aside></article>) : <div className="empty">No additional wallet relationships were resolved in this bounded scan.</div>}
      </div>}

      {tab === "history" && <div className="history">
        {data.previousLaunches.length ? data.previousLaunches.map((h,i)=><article key={h.mint}><span>{String(i+1).padStart(2,"0")}</span><div><strong>{short(h.mint,8)}</strong><p>{h.evidence}</p><small>{when(h.firstSeen)}</small></div><a href={explorer("address",h.mint)} target="_blank">Inspect ↗</a></article>) : <div className="empty">No other mint initialisations were found in the creator-wallet sample. That is not proof this creator has no other launches.</div>}
      </div>}

      {tab === "notebook" && <div className="notebook">
        <div className="notewarning"><b>Analyst-supplied evidence</b><p>Record public aliases and claims here, but RugPrint keeps them separate from on-chain facts. A changed X username is not proof that two accounts belong to the same person.</p></div>
        <label>Known / historical public handles<textarea value={aliases} onChange={e=>setAliases(e.target.value)} placeholder="Example: @oldhandle → @newhandle, source/date…" /></label>
        <label>Public claims to compare with chain evidence<textarea value={claims} onChange={e=>setClaims(e.target.value)} placeholder="Example: ‘Dev never sold’ — link and date…" /></label>
        <p className="tiny">These notes exist only in your browser session and are included in the exported report. RugPrint does not scrape X or claim identity from username changes.</p>
      </div>}

      <div className="coverage"><div><span>Provider</span><b>{data.coverage.provider}</b></div><div><span>Signatures inspected</span><b>{data.coverage.signaturesInspected.toLocaleString()}</b></div><div><span>Transactions parsed</span><b>{data.coverage.transactionsParsed}</b></div><div><span>Earliest observed</span><b>{when(data.creator.firstSeen)}</b></div></div>
      <details><summary>Coverage limits & interpretation</summary>{data.coverage.notes.map((n,i)=><p key={i}>{n}</p>)}</details>
    </section>}
  </>;
}
