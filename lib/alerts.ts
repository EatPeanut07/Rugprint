export const FREE_ALERTS_PER_MONTH = 3;
export type Plan = "trial" | "pro";

export function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}`;
}

export function alertAllowance(plan: Plan, alertsUsed: number) {
  if (plan === "pro") return { allowed: true, remaining: null, limit: null };
  const remaining = Math.max(0, FREE_ALERTS_PER_MONTH - Math.max(0, alertsUsed));
  return { allowed: remaining > 0, remaining, limit: FREE_ALERTS_PER_MONTH };
}
