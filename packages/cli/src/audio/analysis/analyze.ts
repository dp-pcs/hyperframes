import {
  runLadder,
  signalDuration,
  signalProvider,
  type AnalysisQuality,
  type AudioAnalysisProvider,
  type AudioCapability,
  type AudioSignal,
  type LadderStep,
} from "@hyperframes/core/audio-analysis";

/** What `hyperframes audio` asks for when `--only` is not given. */
export const DEFAULT_CAPABILITIES: readonly AudioCapability[] = [
  "kind",
  "moments",
  "onsets",
  "loudness",
  "silence",
  "envelope",
];

/** Every provider the CLI knows, in default ladder order. Model and service providers join this list. */
function audioAnalysisProviders(): AudioAnalysisProvider<AudioSignal>[] {
  return [signalProvider];
}

export interface AnalyzeOptions {
  capabilities: readonly AudioCapability[];
  quality?: AnalysisQuality;
  /** Pin a capability to one provider, skipping the ladder. */
  provider?: Partial<Record<AudioCapability, string>>;
  /** Per-capability options handed to the provider. */
  options?: Partial<Record<AudioCapability, Record<string, unknown>>>;
  /** Seconds into the file where the signal begins; every reported time is shifted by it. */
  fileOffset?: number;
  /** Seconds of signal around the analyzed window, there so onsets at its edges are told from the cut. */
  context?: { before: number; after: number };
}

export interface Analysis {
  /** Seconds of signal analyzed. */
  analyzed: number;
  values: Partial<Record<AudioCapability, unknown>>;
  provenance: Partial<Record<AudioCapability, string | null>>;
  ladder: Partial<Record<AudioCapability, LadderStep[]>>;
  warnings: string[];
}

/** Long signals get a coarser envelope, so one item stays near 2,000 values. */
export function envelopeHopMs(seconds: number, asked?: number): number {
  if (asked !== undefined) return asked;
  return Math.max(5, Math.ceil((seconds * 1000) / 2000));
}

const round = (t: number) => Math.round(t * 1000) / 1000;

/** Move a capability's times from signal seconds to file seconds. */
function toFileTime(capability: AudioCapability, value: unknown, offset: number): unknown {
  if (value === null || typeof value !== "object") return value;
  const at = (t: number) => round(t + offset);
  switch (capability) {
    case "moments": {
      const m = value as Record<string, number>;
      return Object.fromEntries(Object.entries(m).map(([k, t]) => [k, at(t)]));
    }
    case "onsets": {
      const o = value as { events: { t: number; strength: number }[] };
      return { ...o, events: o.events.map((e) => ({ ...e, t: at(e.t) })) };
    }
    case "silence":
      return (value as { start: number; end: number }[]).map((s) => ({
        start: at(s.start),
        end: at(s.end),
      }));
    case "loudness": {
      const l = value as { clipping: { count: number; firstAt: number | null } };
      const firstAt = l.clipping.firstAt === null ? null : at(l.clipping.firstAt);
      return { ...l, clipping: { ...l.clipping, firstAt } };
    }
    case "envelope":
      return { startsAt: round(offset), ...(value as object) };
    default:
      return value;
  }
}

function within(value: unknown, from: number, to: number): unknown {
  if (!value || typeof value !== "object" || !("events" in value)) return value;
  const onsets = value as { events: { t: number }[] };
  return { ...onsets, events: onsets.events.filter((e) => e.t >= from && e.t < to) };
}

interface Framing {
  /** The signal without its context, which every capability but onsets measures. */
  windowed: AudioSignal;
  /** Seconds of context before the window, and where the window ends, in signal seconds. */
  before: number;
  end: number;
  cut: boolean;
}

function frame(signal: AudioSignal, context: AnalyzeOptions["context"]): Framing {
  const before = context?.before ?? 0;
  const skip = Math.round(before * signal.sampleRate);
  const length = signal.channels[0]?.length ?? 0;
  const end = Math.max(skip, length - Math.round((context?.after ?? 0) * signal.sampleRate));
  const cut = skip > 0 || end < length;
  const windowed = cut
    ? { ...signal, channels: signal.channels.map((c) => c.subarray(skip, end)) }
    : signal;
  return { windowed, before, end: end / signal.sampleRate, cut };
}

function optionsFor(capability: AudioCapability, request: AnalyzeOptions, seconds: number) {
  const options = { ...request.options?.[capability] };
  if (capability === "envelope")
    options.hopMs = envelopeHopMs(seconds, options.hopMs as number | undefined);
  return options;
}

export async function analyzeSignal(
  signal: AudioSignal,
  request: AnalyzeOptions,
  providers: readonly AudioAnalysisProvider<AudioSignal>[] = audioAnalysisProviders(),
): Promise<Analysis> {
  const framing = frame(signal, request.context);
  const analysis: Analysis = {
    analyzed: round(signalDuration(framing.windowed)),
    values: {},
    provenance: {},
    ladder: {},
    warnings: [],
  };
  for (const capability of request.capabilities) {
    // Onsets see the context, so a window's edge is not mistaken for a hit, then keep only the window's own.
    const withContext = capability === "onsets" && framing.cut;
    const result = await runLadder(capability, withContext ? signal : framing.windowed, providers, {
      quality: request.quality,
      provider: request.provider?.[capability],
      options: optionsFor(capability, request, analysis.analyzed),
    });
    const value = withContext ? within(result.value, framing.before, framing.end) : result.value;
    const offset = (request.fileOffset ?? 0) - (withContext ? framing.before : 0);
    analysis.values[capability] = toFileTime(capability, value, offset);
    analysis.provenance[capability] = result.provenance;
    analysis.ladder[capability] = result.steps;
    analysis.warnings.push(...result.warnings);
  }
  return analysis;
}
