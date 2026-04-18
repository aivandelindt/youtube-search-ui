import type { DownloadSettings, JobRow } from '../types/jobs'
import type { YoutubeSearchResultItem } from './youtube-search'

export async function fetchJobs(): Promise<JobRow[]> {
  const res = await fetch('/api/downloads')
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) throw new Error('Failed to load jobs')
  if (!body || typeof body !== 'object' || !('jobs' in body)) {
    throw new Error('Invalid jobs response')
  }
  return (body as { jobs: JobRow[] }).jobs
}

export async function postDownloads(
  items: YoutubeSearchResultItem[],
  settings: DownloadSettings,
): Promise<{ jobIds: string[]; deduped: string[] }> {
  const res = await fetch('/api/downloads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: items.map((i) => ({
        videoId: i.videoId,
        title: i.title,
        channel: i.channel,
        url: i.url,
      })),
      settings,
    }),
  })
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const msg =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Download enqueue failed (${res.status})`
    throw new Error(msg)
  }
  return body as { jobIds: string[]; deduped: string[] }
}

export async function postRetryJob(jobId: string): Promise<void> {
  const res = await fetch(`/api/downloads/${jobId}/retry`, { method: 'POST' })
  if (!res.ok) throw new Error('Retry failed')
}

export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`/api/downloads/${jobId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Cancel failed')
}
