export const CREATOR_PLATFORMS = ["pumpfun","fomo","x","wallet"] as const;
export type CreatorPlatform = typeof CREATOR_PLATFORMS[number];

export function normalizeUsername(value:string) {
  return value.trim().replace(/^@/,"").toLowerCase();
}

export function normalizePlatform(value:string): CreatorPlatform | null {
  const normalized=value.trim().toLowerCase().replace(/\./g,"");
  if (normalized==="pumpfun" || normalized==="pump") return "pumpfun";
  if (normalized==="fomo") return "fomo";
  if (normalized==="x" || normalized==="twitter") return "x";
  if (normalized==="wallet") return "wallet";
  return null;
}

/*
  Platform fetchers deliberately live behind this adapter boundary.
  RugPrint should not hard-code undocumented third-party endpoints into UI code.
  The next provider integration can resolve a platform identity and then call
  upsertCreatorIdentity() so stable IDs and observed username history persist.
*/
