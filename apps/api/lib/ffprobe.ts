import { spawn } from "node:child_process";

export async function ffprobeDurationSeconds(
  filePath: string,
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (c: string) => {
      out += c;
    });
    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") resolve(null);
      else reject(err);
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      const n = Number.parseFloat(out.trim());
      resolve(Number.isFinite(n) ? n : null);
    });
  });
}
