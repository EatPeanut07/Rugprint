import Scanner from "@/components/Scanner";

export default function Home() {
  return <main>
    <header className="topbar"><a className="brand" href="/"><span className="finger">⌁</span>RUGPRINT</a><div className="status"><i/> SOLANA MAINNET</div><a className="github" href="https://github.com/" target="_blank">GitHub ↗</a></header>
    <section className="hero">
      <div className="kicker">ON-CHAIN CREATOR INTELLIGENCE</div>
      <h1>They can change the name.<br/><span>Not the footprint.</span></h1>
      <p>Trace launch attribution, creator funding, early-wallet relationships and previous mint activity from evidence the blockchain actually exposes.</p>
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
