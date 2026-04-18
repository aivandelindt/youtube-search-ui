import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { DownloadSettings } from '../types/jobs'

const defaults: DownloadSettings = {
  format: 'mp3',
  qualityPreset: 5,
  forceCbr: true,
  embedThumbnail: true,
  embedMetadata: true,
  normalize: false,
}

type SettingsState = {
  settings: DownloadSettings
  setSettings: (s: Partial<DownloadSettings>) => void
  reset: () => void
}

export const useDownloadSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaults,
      setSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),
      reset: () => set({ settings: defaults }),
    }),
    { name: 'youtube-dj-download-settings' },
  ),
)
