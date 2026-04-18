import fs from "node:fs";
import path from "node:path";

export function getDataDir(): string {
  const base = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), "data");
  fs.mkdirSync(base, { recursive: true });
  return base;
}

export function getLibraryAudioDir(): string {
  const dir = path.join(getDataDir(), "library", "audio");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getYtdlpArchivePath(): string {
  return path.join(getDataDir(), "ytdlp-archive.txt");
}
