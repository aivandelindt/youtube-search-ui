import crypto from "node:crypto";
import type { ExecException } from "node:child_process";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { ffprobeDurationSeconds } from "@/lib/ffprobe";
import { z } from "zod";

const execFileAsync = promisify(execFile);

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

/** JSON line printed by `analyzer/analyze.py` — keep in sync with Python. */
const analysisJsonSchema = z.object({
  bpm: z.number(),
  bpmConfidence: z.number(),
  keyMusical: z.string(),
  keyCamelot: z.string(),
  energy: z.number(),
  integratedLufs: z.number().nullable(),
  beatsJson: z.string(),
  analyzerVersion: z.string(),
});

const STUB_FALLBACK_VERSION = "stub-fallback-0.1.0";

function analyzerScriptCandidates(): string[] {
  if (process.env.ANALYZER_SCRIPT) {
    return [path.resolve(process.env.ANALYZER_SCRIPT)];
  }
  /* cwd = repo root (pnpm dev) or apps/api (pnpm --filter api dev) — try both, no fs.stat (NFT-friendly). */
  const cwd = /* turbopackIgnore: true */ process.cwd();
  return [
    path.join(cwd, "analyzer", "analyze.py"),
    path.join(cwd, "apps", "api", "analyzer", "analyze.py"),
  ];
}

/** Python missing script vs real analysis failure — try alternate cwd-relative path. */
function shouldTryAlternateScriptPath(err: unknown): boolean {
  const e = err as ExecException & { stderr?: Buffer | string };
  const text = `${e.stderr ?? ""}${e.message ?? ""}`;
  return /can't open file|No such file|errno 2/i.test(text);
}

function pythonExecutable(): string {
  return process.env.ANALYZER_PYTHON ?? process.env.PYTHON ?? "python3";
}

async function runPythonAnalyzer(filePath: string): Promise<AnalysisRecord | null> {
  if (process.env.ANALYZER_DISABLE === "1") {
    return null;
  }

  const py = pythonExecutable();
  const timeoutMs = Number(process.env.ANALYZER_TIMEOUT_MS ?? 120_000);
  const scripts = analyzerScriptCandidates();
  let lastErr: unknown;

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i]!;
    try {
      const { stdout, stderr } = await execFileAsync(py, [script, filePath], {
        timeout: timeoutMs,
        maxBuffer: 12 * 1024 * 1024,
        windowsHide: true,
      });
      if (stderr?.trim()) {
        console.warn("[analyze-track] stderr:", stderr.trim());
      }
      const line = stdout.trim();
      if (!line) return null;
      const raw: unknown = JSON.parse(line);
      const parsed = analysisJsonSchema.safeParse(raw);
      if (!parsed.success) {
        console.warn("[analyze-track] invalid analyzer JSON:", parsed.error.flatten());
        return null;
      }
      return parsed.data;
    } catch (err) {
      lastErr = err;
      if (shouldTryAlternateScriptPath(err) && i < scripts.length - 1) {
        continue;
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[analyze-track] Python analyzer failed (${py} ${script}):`, msg);
      return null;
    }
  }

  if (lastErr) {
    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    console.warn(`[analyze-track] Python analyzer failed (${py}):`, msg);
  }
  return null;
}

async function fallbackStubAnalysis(filePath: string): Promise<AnalysisRecord> {
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
      ? Array.from(
          { length: Math.min(32, Math.floor(durationSec / 0.5)) },
          (_, i) => Number((i * 0.5).toFixed(3)),
        )
      : [];

  return {
    bpm,
    bpmConfidence: 0.35,
    keyMusical: pick.musical,
    keyCamelot: pick.camelot,
    energy: 0.5 + (n % 50) / 100,
    integratedLufs: null,
    beatsJson: JSON.stringify(beats),
    analyzerVersion: STUB_FALLBACK_VERSION,
  };
}

/**
 * Runs the Python sidecar (`analyzer/analyze.py`) when available (librosa + pyloudnorm).
 * Falls back to a deterministic stub if Python is missing, the script is not found, or `ANALYZER_DISABLE=1`.
 * Rekordbox/library metadata from the stub should be treated as best-effort, not club-accurate.
 */
export async function analyzeAudioFile(
  filePath: string,
): Promise<AnalysisRecord> {
  const real = await runPythonAnalyzer(filePath);
  if (real) {
    return real;
  }
  console.warn(
    "[analyze-track] using stub fallback; install Python deps: pip install -r analyzer/requirements.txt",
  );
  return fallbackStubAnalysis(filePath);
}
