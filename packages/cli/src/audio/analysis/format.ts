import type {
  Envelope,
  KindGuess,
  Loudness,
  Moments,
  Onsets,
  Span,
} from "@hyperframes/core/audio-analysis";
import type { AudioItem, AudioReport } from "./run.js";
import { filmTime } from "./targets.js";

const BARS = "▁▂▃▄▅▆▇█";
const SPARK_WIDTH = 48;
const ONSETS_SHOWN = 12;

const s = (t: number) => t.toFixed(3);

/** One character per slice of the envelope, from the floor of what it holds to its loudest. */
export function sparkline(envelope: Envelope, width = SPARK_WIDTH): string {
  const { values } = envelope;
  if (values.length === 0) return "";
  const per = Math.max(1, Math.ceil(values.length / width));
  const slices: number[] = [];
  for (let i = 0; i < values.length; i += per) slices.push(Math.max(...values.slice(i, i + per)));
  const top = Math.max(...slices);
  const floor = Math.max(Math.min(...slices), top - 60);
  if (top - floor < 1e-9) return BARS[0]!.repeat(slices.length);
  return slices
    .map(
      (v) => BARS[Math.round(((Math.max(v, floor) - floor) / (top - floor)) * (BARS.length - 1))],
    )
    .join("");
}

type At = (t: number) => string;

function momentsLine(moments: Moments, at: At): string {
  return `  onset ${at(moments.onset)}  steepest ${at(moments.steepest)}  peak ${at(moments.peak)}  tail end ${at(moments.tailEnd)}`;
}

function hitsLine(onsets: Onsets, at: At): string | null {
  if (!onsets.events.length) return null;
  const shown = onsets.events
    .slice(0, ONSETS_SHOWN)
    .map((e) => `${at(e.t)}(${e.strength.toFixed(2)})`);
  const more = onsets.events.length - shown.length;
  return `  hits ${shown.join(" ")}${more > 0 ? ` +${more}` : ""}`;
}

function loudnessLine(loudness: Loudness, at: At): string {
  const lufs = loudness.lufsIntegrated === null ? "below gate" : `${loudness.lufsIntegrated} LUFS`;
  const { count, firstAt } = loudness.clipping;
  const clip = count && firstAt !== null ? `, clips ${count}× from ${at(firstAt)}` : "";
  return `  loudness ${lufs}, true peak ${loudness.truePeakDb} dBTP${clip}`;
}

function silenceLine(silence: Span[], at: At): string | null {
  return silence.length
    ? `  silent ${silence.map((g) => `${at(g.start)}–${at(g.end)}`).join(" ")}`
    : null;
}

/** One line per measurement the item holds, in reading order. */
const LINES: [string, (value: never, at: At) => string | null][] = [
  ["moments", momentsLine],
  ["onsets", hitsLine],
  ["loudness", loudnessLine],
  ["silence", silenceLine],
  ["envelope", (envelope: Envelope) => `  ${sparkline(envelope)}`],
];

function headline(item: AudioItem, where: string): string {
  const kind = item.kind as KindGuess | null | undefined;
  const span = item.placement
    ? `film ${s(item.placement.start)}–${s(item.placement.end)}, file from ${s(item.placement.mediaStart)}`
    : `${s(item.duration ?? 0)} s`;
  return `${where}  ${span}${kind ? `  ${kind.value} (${kind.confidence})` : ""}`;
}

function formatItem(item: AudioItem): string[] {
  const where = item.ref ? `${item.file} ${item.ref}` : item.file;
  if (item.error) return [`${where}: ${item.error}`];
  const at: At = (t) => s(item.placement ? filmTime(item.placement, t) : t);
  const lines = [headline(item, where)];
  for (const [capability, line] of LINES) {
    const value = item[capability];
    const text = value ? line(value as never, at) : null;
    if (text) lines.push(text);
  }
  for (const warning of item.warnings) lines.push(`  ! ${warning}`);
  return lines;
}

export function formatReport(report: AudioReport): string {
  if (report.items.length === 0) return "No audio matched.";
  return report.items.map((item) => formatItem(item).join("\n")).join("\n\n");
}
