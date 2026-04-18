import type { LibraryTrack } from '../types/jobs'

export async function fetchLibrary(params: {
  q?: string
  bpmMin?: number
  bpmMax?: number
  key?: string
}): Promise<LibraryTrack[]> {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.bpmMin != null) sp.set('bpmMin', String(params.bpmMin))
  if (params.bpmMax != null) sp.set('bpmMax', String(params.bpmMax))
  if (params.key) sp.set('key', params.key)
  const res = await fetch(`/api/library?${sp.toString()}`)
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) throw new Error('Failed to load library')
  if (!body || typeof body !== 'object' || !('tracks' in body)) {
    throw new Error('Invalid library response')
  }
  return (body as { tracks: LibraryTrack[] }).tracks
}

export async function deleteTrack(id: string): Promise<void> {
  const res = await fetch(`/api/tracks/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}

export async function postReanalyze(id: string): Promise<void> {
  const res = await fetch(`/api/tracks/${id}/reanalyze`, { method: 'POST' })
  if (!res.ok) throw new Error('Re-analyze failed')
}

export async function postRekordboxExport(
  trackIds: string[],
  playlistName: string,
): Promise<Blob> {
  const res = await fetch('/api/export/rekordbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackIds, playlistName }),
  })
  if (!res.ok) throw new Error('Export failed')
  return res.blob()
}
