import Scanner from "@/components/Scanner";

export default function Home() {
  return <main>
    <header className="topbar"><a className="brand" href="/"><span className="finger">⌁</span>RUGPRINT</a><div className="status"><i/> SOLANA MAINNET</div><a className="github" href="https://github.com/" target="_blank">GitHub ↗</a></header>
    <section className="hero">
      <div className="kicker">ON-CHAIN CREATOR INTELLIGENCE</div>
      <h1>They can change the name.<br/><span>Not the footprint.</span></h1>
      <p>Trace creator candidates, funding paths, wallet relationships and launch history from evidence the blockchain actually exposes.</p>
      <Scanner />
    </section>
    <section className="principles"><article><b>01</b><h3>Evidence, not accusations</h3><p>Every connection carries a confidence level and, where possible, a transaction you can inspect yourself.</p></article><article><b>02</b><h3>Wallets over usernames</h3><p>Social handles are disposable. On-chain relationships give investigators a more durable trail to examine.</p></article><article><b>03</b><h3>No magic black box</h3><p>The scoring logic lives in the repository. Disagree with a signal? Inspect it, challenge it, improve it.</p></article></section>
    <footer><strong>RUGPRINT</strong><span>Research tool. Not financial advice. A risk score is not a finding of fraud or criminal conduct.</span></footer>
  </main>;
}
