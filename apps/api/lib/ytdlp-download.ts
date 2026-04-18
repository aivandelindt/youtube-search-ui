import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { DownloadSettings } from "@/lib/download-settings-schema";
import { getLibraryAudioDir } from "@/lib/paths";

function toPosixPath(p: string): string {
  return p.split(path.sep).join("/");
}

const cbrKbps: Record<DownloadSettings["qualityPreset"], number> = {
  0: 320,
  3: 256,
  5: 192,
  7: 128,
  9: 96,
};

function buildArgs(
  url: string,
  outputPattern: string,
  archivePath: string,
  settings: DownloadSettings,
): string[] {
  const args: string[] = [
    "-f",
    "bestaudio/best",
    "-x",
    "--no-playlist",
    "--newline",
    "--no-warnings",
    "--progress-template",
    "download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
  ];

  args.push("--audio-format", settings.format);

  if (settings.format === "wav") {
    // lossless PCM; quality preset ignored
  } else if (settings.forceCbr) {
    args.push("--audio-quality", `${cbrKbps[settings.qualityPreset]}K`);
  } else {
    args.push("--audio-quality", String(settings.qualityPreset));
  }

  if (settings.embedThumbnail) {
    args.push("--embed-thumbnail", "--convert-thumbnails", "jpg");
    args.push(
      "--postprocessor-args",
      "ThumbnailsConvertor:-vf scale=800:800",
    );
  }
  if (settings.embedMetadata) {
    args.push("--embed-metadata", "--add-metadata");
  }

  args.push("--download-archive", archivePath);
  args.push("-o", toPosixPath(outputPattern));
  args.push(url);
  return args;
}

function resolveDownloadedPath(
  audioDir: string,
  videoId: string,
  settings: DownloadSettings,
): string | null {
  const preferred =
    settings.format === "mp3"
      ? "mp3"
      : settings.format === "m4a"
        ? "m4a"
        : "wav";
  const direct = path.join(audioDir, `${videoId}.${preferred}`);
  if (fs.existsSync(direct)) return direct;

  const names = fs.readdirSync(audioDir);
  const match = names.find((n) => n.startsWith(`${videoId}.`));
  return match ? path.join(audioDir, match) : null;
}

export type YtdlpProgress = {
  percent: number | null;
  rawLine: string;
};

export async function runYtDlpDownload(opts: {
  url: string;
  videoId: string;
  settings: DownloadSettings;
  archivePath: string;
  onProgress: (p: YtdlpProgress) => void;
  abortSignal?: AbortSignal;
}): Promise<{ outputPath: string }> {
  const audioDir = getLibraryAudioDir();
  const outputPattern = path.join(audioDir, `${opts.videoId}.%(ext)s`);
  const args = buildArgs(
    opts.url,
    outputPattern,
    opts.archivePath,
    opts.settings,
  );

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("yt-dlp", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    const onAbort = () => {
      proc.kill("SIGTERM");
    };
    if (opts.abortSignal) {
      if (opts.abortSignal.aborted) {
        onAbort();
      } else {
        opts.abortSignal.addEventListener("abort", onAbort, { once: true });
      }
    }

    let stderr = "";
    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const m = trimmed.match(/(\d+(?:\.\d+)?)\s*%/);
        const percent = m ? Number.parseFloat(m[1]) : null;
        opts.onProgress({
          percent: Number.isFinite(percent) ? percent : null,
          rawLine: trimmed,
        });
      }
    });
    proc.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      reject(err);
    });

    proc.on("close", (code) => {
      if (opts.abortSignal) {
        opts.abortSignal.removeEventListener("abort", onAbort);
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(stderr.trim() || `yt-dlp exited with code ${code ?? "unknown"}`),
      );
    });
  });

  const resolved = resolveDownloadedPath(audioDir, opts.videoId, opts.settings);
  if (!resolved) {
    throw new Error("Download finished but output file was not found on disk.");
  }
  return { outputPath: resolved };
}
