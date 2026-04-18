import { create } from 'zustand'

import { fetchLibrary } from '../api/library'
import type { LibraryTrack } from '../types/jobs'

type LibraryState = {
  tracks: LibraryTrack[]
  loading: boolean
  error: string | null
  filters: { q: string; bpmMin: string; bpmMax: string; key: string }
  setFilters: (f: Partial<LibraryState['filters']>) => void
  load: () => Promise<void>
  setTracks: (tracks: LibraryTrack[]) => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  loading: false,
  error: null,
  filters: { q: '', bpmMin: '', bpmMax: '', key: '' },
  setFilters: (f) =>
    set((s) => ({ filters: { ...s.filters, ...f } })),
  setTracks: (tracks) => set({ tracks }),
  load: async () => {
    set({ loading: true, error: null })
    try {
      const { filters } = get()
      const bpmMin =
        filters.bpmMin.trim() === ''
          ? undefined
          : Number.parseFloat(filters.bpmMin)
      const bpmMax =
        filters.bpmMax.trim() === ''
          ? undefined
          : Number.parseFloat(filters.bpmMax)
      const tracks = await fetchLibrary({
        q: filters.q.trim() || undefined,
        key: filters.key.trim() || undefined,
        bpmMin: Number.isFinite(bpmMin) ? bpmMin : undefined,
        bpmMax: Number.isFinite(bpmMax) ? bpmMax : undefined,
      })
      set({ tracks, loading: false })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Library load failed'
      set({ error: msg, loading: false })
    }
  },
}))
