export async function register(){
  if(process.env.NEXT_RUNTIME!=="nodejs") return;
  const g=globalThis as typeof globalThis&{__rugprintMonitorStarted?:boolean};
  if(!g.__rugprintMonitorStarted){
    g.__rugprintMonitorStarted=true;
    const {runWatchMonitor}=await import("./lib/watch-monitor");
    const run=()=>runWatchMonitor().catch(e=>console.error("RugPrint monitor",e));
    setTimeout(run,15000);
    setInterval(run,5*60*1000);
  }
}
