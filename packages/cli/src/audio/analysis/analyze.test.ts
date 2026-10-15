import { describe, expect, it } from "vitest";
import {
  signalProvider,
  type AudioAnalysisProvider,
  type AudioSignal,
} from "@hyperframes/core/audio-analysis";
import { analyzeSignal, envelopeHopMs } from "./analyze.js";

const RATE = 8000;
const tone: AudioSignal = {
  sampleRate: RATE,
  channels: [Float32Array.from({ length: RATE }, (_, i) => (i > RATE / 2 ? 0.5 * Math.sin(i) : 0))],
};

describe("analyzeSignal", () => {
  it("reports times in file seconds when the signal starts partway into the file", async () => {
    const analysis = await analyzeSignal(tone, {
      capabilities: ["moments", "envelope"],
      fileOffset: 2,
    });
    expect((analysis.values.moments as { onset: number }).onset).toBeCloseTo(2.5, 2);
    expect(analysis.values.envelope).toMatchObject({ startsAt: 2 });
  });

  it("follows a provider pinned to a capability and says which one answered", async () => {
    const fixed: AudioAnalysisProvider<AudioSignal> = {
      id: "fixed",
      local: true,
      capabilities: ["moments"],
      analyze: async () => ({ onset: 0.1, steepest: 0.1, peak: 0.1, tailEnd: 0.2 }),
    };
    const analysis = await analyzeSignal(
      tone,
      { capabilities: ["moments", "loudness"], provider: { moments: "fixed" }, fileOffset: 1 },
      [signalProvider, fixed],
    );
    expect(analysis.provenance).toEqual({ moments: "fixed", loudness: "signal" });
    expect(analysis.values.moments).toEqual({ onset: 1.1, steepest: 1.1, peak: 1.1, tailEnd: 1.2 });
  });

  it("warns, and answers nothing, for a capability no provider offers yet", async () => {
    const analysis = await analyzeSignal(tone, { capabilities: ["beats"] });
    expect(analysis.values.beats).toBeNull();
    expect(analysis.warnings).toEqual(["beats: no provider answered (none offers it)"]);
  });
});

describe("envelopeHopMs", () => {
  it("keeps short sounds at 5 ms and coarsens long ones to about 2,000 values", () => {
    expect(envelopeHopMs(1)).toBe(5);
    expect(envelopeHopMs(180)).toBe(90);
    expect(envelopeHopMs(180, 20)).toBe(20);
  });
});
