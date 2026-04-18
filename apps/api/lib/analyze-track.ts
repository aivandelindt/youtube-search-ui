import crypto from "node:crypto";

import { ffprobeDurationSeconds } from "@/lib/ffprobe";

export type AnalysisRecord = {
  bpm: number;
  bpmConfidence: number;
  keyMusical: string;
  keyCamelot: string;
  energy: number;
  integratedLufs: number | null;
  beatsJson: string;
  analyzerVersion: string;
};

/**
 * Placeholder analysis when no Python sidecar is configured.
 * Replace with essentia/librosa by spawning analyzer/analyze.py later.
 */
export async function analyzeAudioFile(
  filePath: string,
): Promise<AnalysisRecord> {
  const durationSec = await ffprobeDurationSeconds(filePath);
  const seed = crypto.createHash("sha256").update(filePath).digest();
  const n = seed.readUInt32BE(0);
  const bpm = 110 + (n % 41);

  const keys = [
    { musical: "A minor", camelot: "8A" },
    { musical: "B major", camelot: "1B" },
    { musical: "F# minor", camelot: "11A" },
    { musical: "D minor", camelot: "7A" },
  ];
  const pick = keys[n % keys.length];

  const beats =
    durationSec != null
      ? Array.from({ length: Math.min(32, Math.floor(durationSec / 0.5)) }, (_, i) =>
          Number((i * 0.5).toFixed(3)),
        )
      : [];

  return {
    bpm,
    bpmConfidence: 0.55,
    keyMusical: pick.musical,
    keyCamelot: pick.camelot,
    energy: 0.5 + (n % 50) / 100,
    integratedLufs: null,
    beatsJson: JSON.stringify(beats),
    analyzerVersion: "stub-0.1.0",
  };
}
