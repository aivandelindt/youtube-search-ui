import { useDownloadSettingsStore } from '../stores/download-settings-store'

export function DownloadSettingsForm() {
  const { settings, setSettings } = useDownloadSettingsStore()

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-4">
        <h3 className="card-title text-base">Download defaults</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="form-control w-full">
            <span className="label-text">Format</span>
            <select
              className="select select-bordered select-sm"
              value={settings.format}
              onChange={(e) =>
                setSettings({
                  format: e.target.value as 'mp3' | 'm4a' | 'wav',
                })
              }
            >
              <option value="mp3">MP3</option>
              <option value="m4a">M4A (AAC)</option>
              <option value="wav">WAV</option>
            </select>
          </label>
          <label className="form-control w-full">
            <span className="label-text">Quality preset</span>
            <select
              className="select select-bordered select-sm"
              value={settings.qualityPreset}
              disabled={settings.format === 'wav'}
              onChange={(e) =>
                setSettings({
                  qualityPreset: Number(e.target.value) as 0 | 3 | 5 | 7 | 9,
                })
              }
            >
              <option value={0}>0 — Best</option>
              <option value={3}>3 — High</option>
              <option value={5}>5 — Balanced</option>
              <option value={7}>7 — Smaller</option>
              <option value={9}>9 — Smallest</option>
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={settings.forceCbr}
              disabled={settings.format === 'wav'}
              onChange={(e) => setSettings({ forceCbr: e.target.checked })}
            />
            <span className="label-text">Force CBR (recommended for CDJs)</span>
          </label>
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={settings.embedThumbnail}
              onChange={(e) =>
                setSettings({ embedThumbnail: e.target.checked })
              }
            />
            <span className="label-text">Embed thumbnail</span>
          </label>
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={settings.embedMetadata}
              onChange={(e) =>
                setSettings({ embedMetadata: e.target.checked })
              }
            />
            <span className="label-text">Embed metadata</span>
          </label>
        </div>
      </div>
    </div>
  )
}
