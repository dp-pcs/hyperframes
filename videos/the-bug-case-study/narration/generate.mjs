#!/usr/bin/env node
// Generate ElevenLabs narration MP3 + word-level transcript JSON.
// Usage: node generate.mjs
//   Reads master-script.txt, writes master-narration.mp3 + master-transcript.json

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, "master-script.txt");
const audioPath = join(__dirname, "master-narration.mp3");
const transcriptPath = join(__dirname, "master-transcript.json");

const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";

if (!apiKey) throw new Error("Missing ELEVENLABS_API_KEY");
if (!voiceId) throw new Error("Missing ELEVENLABS_VOICE_ID");

const text = readFileSync(scriptPath, "utf-8").trim();
console.log(`Synthesizing ${text.length} chars with voice ${voiceId} (model ${modelId})...`);

const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      seed: 42,
    }),
  },
);

const raw = await response.text();
if (!response.ok) {
  console.error(`ElevenLabs request failed (${response.status}):`, raw.slice(0, 800));
  process.exit(1);
}

const parsed = JSON.parse(raw);
if (!parsed.audio_base64) {
  console.error("Response missing audio_base64");
  process.exit(1);
}

const audio = Buffer.from(parsed.audio_base64, "base64");
writeFileSync(audioPath, audio);
console.log(`Wrote ${audioPath} (${audio.length} bytes)`);

const alignment = parsed.alignment || parsed.normalized_alignment;
if (!alignment) {
  console.error("Response missing alignment");
  process.exit(1);
}

const chars = alignment.characters || [];
const starts = alignment.character_start_times_seconds || [];
const ends = alignment.character_end_times_seconds || [];

const words = [];
let current = "";
let wordStart = null;
let wordEnd = null;

for (let i = 0; i < chars.length; i++) {
  const char = chars[i];
  const start = starts[i] ?? wordEnd ?? 0;
  const end = ends[i] ?? start;
  if (/\s/.test(char)) {
    if (current && wordStart !== null && wordEnd !== null) {
      words.push({ text: current, start: wordStart, end: wordEnd });
    }
    current = "";
    wordStart = null;
    wordEnd = null;
    continue;
  }
  current += char;
  if (wordStart === null) wordStart = start;
  wordEnd = end;
}
if (current && wordStart !== null && wordEnd !== null) {
  words.push({ text: current, start: wordStart, end: wordEnd });
}

const totalDuration = words.length ? words[words.length - 1].end : 0;
const transcript = {
  voiceId,
  modelId,
  totalDurationSeconds: totalDuration,
  words,
};
writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2));
console.log(`Wrote ${transcriptPath} (${words.length} words, ${totalDuration.toFixed(2)}s total)`);
