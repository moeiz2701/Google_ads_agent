/**
 * Typed execution-layer errors. The launch route maps each to a distinct HTTP
 * status so the UI can react precisely (policy → fix copy, validation → fix
 * config). Errors carry the offending items as structured context.
 */

/** Config failed deterministic structural validation (no enabled ads, etc.). */
export class ValidationError extends Error {
  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * The deterministic policy pre-check (§7.2) rejected the launch. This is the
 * final gate before publish — blocked ads must be edited before relaunch.
 */
export class PolicyError extends Error {
  constructor(
    message: string,
    readonly violations: PolicyViolation[],
  ) {
    super(message);
    this.name = "PolicyError";
  }
}

export interface PolicyViolation {
  /** Where the offending text lives, e.g. "ad group 'Trust' / search headline". */
  location: string;
  /** The text that tripped the gate (the actual ad copy — safe to surface). */
  text: string;
  /** Why it was flagged. */
  reason: string;
}
