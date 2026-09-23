export const FREE_ALERTS_PER_MONTH = 3;
export type Plan = "trial" | "pro";
export function alertAllowance(plan: Plan, alertsUsed: number) {
  if (plan === "pro") return { allowed: true, remaining: null, limit: null };
  const remaining = Math.max(0, FREE_ALERTS_PER_MONTH - alertsUsed);
  return { allowed: remaining > 0, remaining, limit: FREE_ALERTS_PER_MONTH };
}
