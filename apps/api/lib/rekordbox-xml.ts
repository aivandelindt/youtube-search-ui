import { pathToFileURL } from "node:url";

import type { LibraryRow } from "@/lib/jobs-repo";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRekordboxCollectionXml(
  tracks: LibraryRow[],
  playlistName: string,
): string {
  const entries = tracks.length;
  const trackBlocks = tracks
    .map((t) => {
      const location = pathToFileURL(t.filePath).href;
      const totalTimeMs = Math.round((t.durationSec ?? 0) * 1000);
      const bpm = t.bpm != null ? t.bpm.toFixed(2) : "0.00";
      const tonality = xmlEscape(t.keyMusical ?? "");
      const kind =
        t.format === "mp3"
          ? "MP3 File"
          : t.format === "m4a"
            ? "AAC File"
            : "WAV File";
      return `    <TRACK TrackID="${xmlEscape(t.id)}" Name="${xmlEscape(t.title)}" Artist="${xmlEscape(t.artist ?? t.channel ?? "")}" AverageBpm="${bpm}" Tonality="${tonality}" TotalTime="${totalTimeMs}" Kind="${kind}" Location="${xmlEscape(location)}"/>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rekordbox" Version="6.0.0" Company="AlphaTheta"/>
  <COLLECTION Entries="${entries}">
${trackBlocks}
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="0" Name="${xmlEscape(playlistName)}" Count="${entries}">
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>
`;

}
