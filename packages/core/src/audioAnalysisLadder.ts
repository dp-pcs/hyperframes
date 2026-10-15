/**
 * The provider ladder for audio analysis. Each capability lists providers best first; a call takes the first one
 * that is available within the requested quality and answers, falling through on failure. The result says which
 * provider answered and why the ones above it did not.
 */

export type AudioCapability =
  | "envelope"
  | "onsets"
  | "moments"
  | "loudness"
  | "silence"
  | "kind"
  | "beats"
  | "sections"
  | "words"
  | "describe";

/** `best` may use any provider; `local` none that sends audio off the machine; `fast` only signal processing. */
export type AnalysisQuality = "best" | "local" | "fast";

export interface AudioAnalysisProvider<Input = unknown> {
  id: string;
  /** Runs on this machine; a provider that is not local sends the audio to a service. */
  local: boolean;
  /** Pure signal processing: no model, no download. */
  signal?: boolean;
  capabilities: readonly AudioCapability[];
  /** Whether it can run here now: a key, a platform, a model on disk. Missing means always. */
  available?: () => boolean | Promise<boolean>;
  analyze: (
    capability: AudioCapability,
    input: Input,
    options: Record<string, unknown>,
  ) => Promise<unknown>;
}

export type LadderOutcome = "answered" | "unavailable" | "excluded" | "failed";

export interface LadderStep {
  provider: string;
  outcome: LadderOutcome;
  reason?: string;
}

export interface LadderResult<Value = unknown> {
  value: Value | null;
  /** The provider that answered; null when none could. */
  provenance: string | null;
  steps: LadderStep[];
  warnings: string[];
}

export interface LadderOptions {
  quality?: AnalysisQuality;
  /** This capability's ladder, best first, in place of the default. */
  ladder?: readonly string[];
  /** Use only this provider. */
  provider?: string;
  options?: Record<string, unknown>;
}

/** The default order per capability: every registered provider that offers it, in registration order. */
export function defaultLadder<Input>(
  capability: AudioCapability,
  providers: readonly AudioAnalysisProvider<Input>[],
): string[] {
  return providers.filter((p) => p.capabilities.includes(capability)).map((p) => p.id);
}

/** Why a provider may not be used at this quality, or null when it may. */
export function exclusion<Input>(
  provider: AudioAnalysisProvider<Input>,
  quality: AnalysisQuality,
): string | null {
  if (quality === "fast" && !provider.signal) return "quality fast allows signal processing only";
  if (quality === "local" && !provider.local) return "quality local keeps audio on this machine";
  return null;
}

/** Why a provider cannot take this step, or null when it can. */
async function blocked<Input>(
  id: string,
  candidate: AudioAnalysisProvider<Input> | undefined,
  capability: AudioCapability,
  quality: AnalysisQuality,
): Promise<LadderStep | null> {
  if (!candidate?.capabilities.includes(capability))
    return { provider: id, outcome: "unavailable", reason: `no provider ${id} for ${capability}` };
  const excluded = exclusion(candidate, quality);
  if (excluded) return { provider: id, outcome: "excluded", reason: excluded };
  if (candidate.available && !(await candidate.available()))
    return { provider: id, outcome: "unavailable" };
  return null;
}

export async function runLadder<Input, Value = unknown>(
  capability: AudioCapability,
  input: Input,
  providers: readonly AudioAnalysisProvider<Input>[],
  { quality = "best", ladder, provider, options = {} }: LadderOptions = {},
): Promise<LadderResult<Value>> {
  const byId = new Map(providers.map((p) => [p.id, p]));
  const order = provider ? [provider] : (ladder ?? defaultLadder(capability, providers));
  const steps: LadderStep[] = [];
  for (const id of order) {
    const candidate = byId.get(id);
    const skip = await blocked(id, candidate, capability, quality);
    if (skip) {
      steps.push(skip);
      continue;
    }
    try {
      const value = (await candidate!.analyze(capability, input, options)) as Value;
      steps.push({ provider: id, outcome: "answered" });
      const warnings = steps
        .filter((step) => step.outcome === "failed")
        .map((step) => `${capability}: ${step.provider} failed (${step.reason}); used ${id}`);
      return { value, provenance: id, steps, warnings };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      steps.push({ provider: id, outcome: "failed", reason });
    }
  }
  const none = order.length ? "" : " (none offers it)";
  return {
    value: null,
    provenance: null,
    steps,
    warnings: [`${capability}: no provider answered${none}`],
  };
}
