"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { RegistryCluster } from "@/lib/registry";

type LookupMatch = { cluster: RegistryCluster; aliasSimilarity: number; matchedAlias: { platform:string; username:string } | null; walletMatch:boolean; clusterMatch:boolean };

const money = (v: number | null) => v == null ? "Not published" : new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(v);

export default function RegistryPage() {
  const [clusters, setClusters] = useState<RegistryCluster[]>([]);
  const [configured, setConfigured] = useState(true);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<LookupMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetch("/api/registry").then(r=>r.json()).then(j=>{setClusters(j.clusters||[]);setConfigured(Boolean(j.configured));}).catch(()=>setConfigured(false)); }, []);

  const leaders = useMemo(() => clusters.filter(c=>c.status === "confirmed_adverse" || c.status === "high").slice(0,10), [clusters]);

  async function lookup(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError(""); setMatches([]);
    try {
      const q = query.trim();
      const body = q.toUpperCase().startsWith("RP-") ? { clusterId:q } : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q) ? { wallet:q } : { alias:q.replace(/^@/,"") };
      const res = await fetch("/api/registry/lookup", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error || "Lookup failed"); setMatches(j.matches||[]); setConfigured(Boolean(j.configured));
    } catch (e) { setError(e instanceof Error ? e.message : "Lookup failed"); } finally { setLoading(false); }
  }

  return <main>
    <header className="topbar"><a className="brand" href="/"><span className="finger">⌁</span>RUGPRINT</a><div className="status"><i/> CREATOR REGISTRY</div><a className="github" href="/">Scanner ↗</a></header>
    <section className="registryhero">
      <div className="kicker">PERSISTENT CREATOR REPUTATION</div>
      <h1>The reset button<br/><span>stops here.</span></h1>
      <p>Search a public alias, wallet or RugPrint cluster. Similar usernames are treated as leads, never proof. High-risk publication requires stronger supporting evidence.</p>
      <form className="registrysearch" onSubmit={lookup}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="@username, wallet or RP-cluster…"/><button disabled={!query.trim()||loading}>{loading?"Checking…":"Search registry"}</button></form>
      {!configured && <div className="registrysetup"><b>Registry code is installed.</b><span>Connect Supabase in Vercel to turn on persistent catalogue storage. Until then the public catalogue stays empty rather than inventing entries.</span></div>}
      {error && <div className="error">{error}</div>}
      {!!matches.length && <section className="registrymatches"><div className="sectionhead"><span>IDENTITY MATCHES</span><b>{matches.length}</b></div>{matches.map(m=><article key={m.cluster.id}><div><span className={`statuspill ${m.cluster.status}`}>{m.cluster.status.replaceAll("_"," ")}</span><h3>{m.cluster.clusterId}</h3><p>{m.cluster.headline || "Evidence-reviewed creator cluster"}</p></div><div className="matchscore"><strong>{m.clusterMatch||m.walletMatch?100:m.aliasSimilarity}%</strong><span>{m.clusterMatch?"cluster ID match":m.walletMatch?"wallet match":"username similarity only"}</span></div><div className="matchmeta"><span>{m.cluster.adverseEvents} adverse events</span><span>{m.cluster.linkedLaunches} linked launches</span><span>{m.cluster.confidence}% evidence confidence</span></div>{m.matchedAlias && <small>Closest public alias: {m.matchedAlias.platform} @{m.matchedAlias.username}</small>}</article>)}</section>}
    </section>

    <section className="leaderboard">
      <div className="sectionhead"><div><span>RUGPRINT RISK INDEX</span><h2>Most active repeat adverse clusters</h2></div><p>Ranked by reviewed adverse events, linked launches and evidence confidence. This is not a finding of criminal guilt.</p></div>
      {leaders.length ? <div className="leaderlist">{leaders.map((c,i)=><article key={c.id}><b className="rank">#{String(i+1).padStart(2,"0")}</b><div className="leadername"><span className={`statuspill ${c.status}`}>{c.status.replaceAll("_"," ")}</span><h3>{c.clusterId}</h3><p>{c.aliases.slice(0,3).map(a=>`${a.platform}: @${a.username}`).join(" · ") || "No public aliases published"}</p></div><div className="leaderstat"><strong>{c.adverseEvents}</strong><span>adverse events</span></div><div className="leaderstat"><strong>{c.linkedLaunches}</strong><span>linked launches</span></div><div className="leaderstat"><strong>{c.associatedWallets}</strong><span>wallets</span></div><div className="leaderstat"><strong>{c.confidence}%</strong><span>confidence</span></div></article>)}</div> : <div className="empty registryempty">No evidence-reviewed clusters are public yet. RugPrint starts empty on purpose. Catalogue entries appear only after review.</div>}
    </section>

    <section className="registryprinciples"><article><b>Alias-resistant</b><p>pepit, pepit1, pep_it and lookalike-character variants can be surfaced as candidate aliases, then checked against wallets, funders and launch behaviour.</p></article><article><b>Evidence-gated</b><p>A similar username alone cannot place somebody on the high-risk leaderboard. Wallet and behavioural evidence must support the association.</p></article><article><b>Appealable</b><p>Registry records include an appeal state so corrections and disputed associations can be reviewed instead of becoming permanent unchallengeable labels.</p></article></section>
    <footer><strong>RUGPRINT</strong><span>Public intelligence registry. Evidence levels describe association strength, not legal guilt.</span></footer>
  </main>;
}
