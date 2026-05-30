# SCRIPT — The Bug That Kept Cutting Our AI Videos Off

Narration for the Part 2 explainer video. Manifesto-register. ~60 words.
The voice is sparse; the visuals carry most of the runtime.

## Voice settings (ElevenLabs)

- Style: `documentary` (calm, confident, declarative)
- Model: `eleven_multilingual_v2`
- Voice: env `ELEVENLABS_VOICE_ID`

## Full master script (single MP3)

The script is generated as a single MP3 and the audio drives a single
`<audio>` element in the master composition.

```
Last week, we shipped a bug.

Our AI-generated videos cut off mid-sentence. The visuals finished. The voice did not.

The model locked the duration. Then ElevenLabs ran longer than it said it would.

The fix: one pure function. After the voice came back, rewrite data-duration on three elements. Root. Narration track. Last scene.

Timelines now match within zero point two seconds. Zero truncated videos in forty-eight hours.

When the model owns a dimension, audit every dimension that depends on it.
```

## Beat-by-beat timing (target)

| Beat | Caption                                                          | Target narration window |
| ---- | ---------------------------------------------------------------- | ----------------------- |
| 1    | HOOK — "Last week, we shipped a bug."                            | 0.0s → ~3.5s            |
| 2    | SYMPTOM — "Our AI-generated videos cut off mid-sentence. The visuals finished. The voice did not." | ~4.0s → ~13.0s |
| 3    | ROOT CAUSE — "The model locked the duration. Then ElevenLabs ran longer than it said it would." | ~14.0s → ~22.0s |
| 4    | THE FIX — "The fix: one pure function. After the voice came back, rewrite data-duration on three elements. Root. Narration track. Last scene." | ~23.0s → ~37.0s |
| 5    | RESULT — "Timelines now match within zero point two seconds. Zero truncated videos in forty-eight hours." | ~38.0s → ~48.0s |
| 6    | LESSON + CTA — "When the model owns a dimension, audit every dimension that depends on it." | ~49.0s → ~57.0s, then ~10s silent hold on QR + CTA |

## Meta acceptance test

We're using the exact pipeline the article describes. The fix described in the
article — `extendCompositionDuration` — is what makes _this_ video play all
the way through. If the narration overruns the planned beat durations, the
final master composition will be extended by the fix. The video about the bug
is rendered by the bug-free version of the system.
