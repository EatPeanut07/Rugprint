const base = (process.env.RUGPRINT_BASE_URL || "").replace(/\/$/, "");
const secret = process.env.RUGPRINT_ADMIN_SECRET;
const interval = Math.max(
  Number(process.env.RUGPRINT_BACKFILL_INTERVAL_MS || 30000),
  10000
);

if (!base) throw new Error("RUGPRINT_BASE_URL is missing");
if (!secret) throw new Error("RUGPRINT_ADMIN_SECRET is missing");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(
      base + "/api/intelligence/backfill",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + secret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batch: 3,
          pages: 2,
        }),
        signal: controller.signal,
      }
    );

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        "Backfill API " +
          response.status +
          ": " +
          text.slice(0, 500)
      );
    }

    console.log("RugPrint backfill", text);
  } finally {
    clearTimeout(timeout);
  }
}

console.log("RugPrint historical worker started");

while (true) {
  try {
    await run();
  } catch (error) {
    console.error("RugPrint worker", error);
  }

  await sleep(interval);
}
