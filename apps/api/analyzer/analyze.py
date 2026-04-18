#!/usr/bin/env python3
"""
Audio analysis sidecar: reads one audio file path (argv), prints one JSON object to stdout.

Contract must stay in sync with apps/api/lib/analyze-track.ts (AnalysisRecord + zod schema).
"""

from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path

import numpy as np

import librosa

# librosa warns on short clips; keep stderr clean for Node (only JSON on stdout on success)
warnings.filterwarnings("ignore", category=UserWarning, module="librosa")

ANALYZER_VERSION = "python-librosa-1.0.0"

# Trim long tracks for CPU/memory (seconds)
MAX_DURATION_SEC = 120.0

# Open-key style Camelot: major -> 1B–12B, minor -> 1A–12A
MAJOR_PC_TO_NUM = {
    0: 8,
    7: 9,
    2: 10,
    9: 11,
    4: 12,
    11: 1,
    6: 2,
    1: 3,
    8: 4,
    3: 5,
    10: 6,
    5: 7,
}
MINOR_PC_TO_NUM = {
    8: 1,
    3: 2,
    10: 3,
    5: 4,
    0: 5,
    7: 6,
    2: 7,
    9: 8,
    4: 9,
    11: 10,
    6: 11,
    1: 12,
}

ROOT_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Krumhansl–Kessler key-finding profiles (12-D chroma), major / minor
KK_MAJOR = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
    dtype=np.float64,
)
KK_MINOR = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
    dtype=np.float64,
)


def _camelot_for_key(root_pc: int, mode: str) -> str:
    if mode == "major":
        n = MAJOR_PC_TO_NUM[root_pc]
        return f"{n}B"
    n = MINOR_PC_TO_NUM[root_pc]
    return f"{n}A"


def _musical_name(root_pc: int, mode: str) -> str:
    return f"{ROOT_NAMES[root_pc]} {mode}"


def _estimate_key(chroma_agg: np.ndarray) -> tuple[int, str, float]:
    """Return (root_pc, mode, confidence 0..1)."""
    x = chroma_agg.astype(np.float64)
    x = x / (np.linalg.norm(x) + 1e-12)
    best_s = -1.0
    best: tuple[int, str] | None = None
    for mode, prof in (("major", KK_MAJOR), ("minor", KK_MINOR)):
        p = prof / (np.linalg.norm(prof) + 1e-12)
        for root in range(12):
            rolled = np.roll(p, root)
            s = float(np.dot(x, rolled))
            if s > best_s:
                best_s = s
                best = (root, mode)
    assert best is not None
    # Heuristic: raw dot ~0.2–0.95 -> map to confidence
    conf = float(np.clip((best_s - 0.15) / 0.65, 0.15, 0.95))
    return best[0], best[1], conf


def _bpm_confidence(onset_env: np.ndarray, tempo: float) -> float:
    """Rough 0..1 confidence from onset strength variability."""
    if onset_env.size < 2 or tempo <= 0:
        return 0.35
    env = onset_env - float(np.mean(onset_env))
    cv = float(np.std(env) / (np.mean(np.abs(onset_env)) + 1e-8))
    # Empirical: typical music gives cv in ~0.5–3.0
    return float(np.clip(0.4 + 0.35 * np.tanh(cv - 1.0), 0.35, 0.95))


def _energy_01(y: np.ndarray) -> float:
    rms = librosa.feature.rms(y=y)[0]
    m = float(np.mean(rms))
    # Normalize roughly to 0..1 (quiet clips stay low)
    return float(np.clip(m * 8.0, 0.0, 1.0))


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: analyze.py <audio_file>", file=sys.stderr)
        sys.exit(2)
    path = Path(sys.argv[1]).resolve()
    if not path.is_file():
        print(f"Not a file: {path}", file=sys.stderr)
        sys.exit(2)

    try:
        y, sr = librosa.load(
            str(path),
            sr=44100,
            mono=True,
            duration=MAX_DURATION_SEC,
        )
    except Exception as e:
        print(f"load_failed: {e}", file=sys.stderr)
        sys.exit(1)

    if y.size < sr // 4:
        print("audio_too_short", file=sys.stderr)
        sys.exit(1)

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo_arr, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
    tempo = float(np.atleast_1d(tempo_arr)[0])
    if not (60.0 <= tempo <= 200.0):
        t_alt = librosa.beat.tempo(onset_envelope=onset_env, sr=sr)
        tempo = float(np.atleast_1d(t_alt)[0])
    tempo = float(np.clip(tempo, 60.0, 200.0))

    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    beat_list = [round(float(t), 4) for t in beat_times[:128]]

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_agg = np.mean(chroma, axis=1)
    root_pc, mode, key_conf = _estimate_key(chroma_agg)

    bpm_conf = _bpm_confidence(onset_env, tempo)
    # Blend key detector confidence slightly
    bpm_conf = float(np.clip(0.7 * bpm_conf + 0.3 * key_conf, 0.2, 0.95))

    energy = _energy_01(y)

    integrated_lufs: float | None
    try:
        import pyloudnorm as pyln

        # pyloudnorm expects shape (n,) or (n, ch)
        meter = pyln.Meter(sr)
        integrated_lufs = float(meter.integrated_loudness(y.astype(np.float64)))
    except Exception:
        integrated_lufs = None

    out = {
        "bpm": round(tempo, 2),
        "bpmConfidence": round(bpm_conf, 4),
        "keyMusical": _musical_name(root_pc, mode),
        "keyCamelot": _camelot_for_key(root_pc, mode),
        "energy": round(energy, 4),
        "integratedLufs": integrated_lufs,
        "beatsJson": json.dumps(beat_list),
        "analyzerVersion": ANALYZER_VERSION,
    }
    print(json.dumps(out), flush=True)


if __name__ == "__main__":
    main()
