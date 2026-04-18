export type JobStatus =
  | 'queued'
  | 'downloading'
  | 'converting'
  | 'analyzing'
  | 'done'
  | 'failed'
  | 'cancelled'

export type DownloadSettings = {
  format: 'mp3' | 'm4a' | 'wav'
  qualityPreset: 0 | 3 | 5 | 7 | 9
  forceCbr: boolean
  embedThumbnail: boolean
  embedMetadata: boolean
  normalize?: boolean
}

export type JobRow = {
  id: string
  status: JobStatus
  phase: string | null
  videoId: string
  title: string
  channel: string
  url: string
  settings: DownloadSettings
  progress: number
  error: string | null
  outputPath: string | null
  trackId: string | null
  createdAt: string
  updatedAt: string
}

export type LibraryTrack = {
  id: string
  videoId: string
  title: string
  artist: string | null
  channel: string | null
  filePath: string
  format: string
  durationSec: number | null
  bpm: number | null
  keyCamelot: string | null
  keyMusical: string | null
  energy: number | null
  createdAt: string
}
