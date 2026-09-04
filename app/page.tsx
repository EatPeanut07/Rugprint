import Scanner from "@/components/Scanner";

export default function Home() {
  return <main>
    <header className="topbar"><a className="brand" href="/"><span className="finger">⌁</span>RUGPRINT</a><div className="status"><i/> SOLANA MAINNET</div><a className="github" href="/registry">Risk Index ↗</a></header>
    <section className="hero">
      <div className="kicker">ON-CHAIN CREATOR INTELLIGENCE</div>
      <h1>They can change the name.<br/><span>Not the footprint.</span></h1>
      <p>Search a Solana contract, X username or Pump.fun username, then trace public identity associations into creator wallets, funding paths and previous mint activity. RugPrint now includes a persistent creator-registry architecture and alias-resistant lookup.</p>
      <Scanner />
    </section>
    <section className="principles">
      <article><b>01</b><h3>Evidence, not accusations</h3><p>Every connection carries a confidence level and, where possible, a transaction you can inspect yourself.</p></article>
      <article><b>02</b><h3>Unknown is not safe</h3><p>If creator attribution or funding provenance is incomplete, RugPrint says UNRESOLVED instead of handing out a misleading green score.</p></article>
      <article><b>03</b><h3>Persistent creator footprints</h3><p>Funding paths, repeat mint activity and early-wallet patterns are harder to erase than a disposable username.</p></article>
    </section>
    <footer><strong>RUGPRINT</strong><span>Research tool. Not financial advice. A risk signal is not a finding of fraud or criminal conduct.</span></footer>
  </main>;
}
