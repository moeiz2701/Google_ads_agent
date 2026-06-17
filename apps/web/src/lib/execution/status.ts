import type { CampaignConfig, CampaignStatus } from "@gaa/shared";

/**
 * Post-launch status (§9.2): `scheduled` if the flight start is in the future,
 * otherwise `running`. Pure + deterministic so it is unit-testable with a frozen
 * clock. A missing/unparseable start date means "start now" → running.
 */
export function postLaunchStatus(
  flightDates: CampaignConfig["flight_dates"],
  now: Date = new Date(),
): CampaignStatus {
  const start = flightDates?.start;
  if (!start) return "running";
  const startMs = Date.parse(start);
  if (Number.isNaN(startMs)) return "running";
  return startMs > now.getTime() ? "scheduled" : "running";
}
