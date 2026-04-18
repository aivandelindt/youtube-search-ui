import { useEffect, useState } from 'react'

import { postRekordboxExport, deleteTrack, postReanalyze } from '../api/library'
import { useLibraryStore } from '../stores/library-store'
import { formatDuration } from '../lib/format'

export function LibraryPanel() {
  const { tracks, loading, error, filters, setFilters, load } = useLibraryStore()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [playlistName, setPlaylistName] = useState('Exported')

  useEffect(() => {
    void useLibraryStore.getState().load()
  }, [])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exportXml = async () => {
    if (selected.size === 0) return
    try {
      const blob = await postRekordboxExport([...selected], playlistName)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'rekordbox-export.xml'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed'
      window.alert(msg)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body gap-4">
          <h3 className="card-title text-base">Library filters</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <input
              type="search"
              placeholder="Search title / channel"
              className="input input-bordered input-sm"
              value={filters.q}
              onChange={(e) => setFilters({ q: e.target.value })}
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="BPM min"
              className="input input-bordered input-sm"
              value={filters.bpmMin}
              onChange={(e) => setFilters({ bpmMin: e.target.value })}
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="BPM max"
              className="input input-bordered input-sm"
              value={filters.bpmMax}
              onChange={(e) => setFilters({ bpmMax: e.target.value })}
            />
            <input
              type="text"
              placeholder="Key (e.g. 8A or Am)"
              className="input input-bordered input-sm"
              value={filters.key}
              onChange={(e) => setFilters({ key: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : null}
              Apply
            </button>
          </div>
          {error ? (
            <div role="alert" className="alert alert-error text-sm">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="form-control">
          <span className="label-text text-xs">Playlist name (XML)</span>
          <input
            type="text"
            className="input input-bordered input-sm"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={selected.size === 0}
          onClick={() => void exportXml()}
        >
          Export Rekordbox XML
        </button>
      </div>

      <div className="overflow-x-auto rounded-box bg-base-100 shadow-xl">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={
                    tracks.length > 0 && selected.size === tracks.length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelected(new Set(tracks.map((t) => t.id)))
                    } else {
                      setSelected(new Set())
                    }
                  }}
                />
              </th>
              <th>Title</th>
              <th>BPM</th>
              <th>Key</th>
              <th>Duration</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tracks.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-base-content/60">
                  No tracks in the library yet.
                </td>
              </tr>
            ) : (
              tracks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={selected.has(t.id)}
                      onChange={() => toggle(t.id)}
                    />
                  </td>
                  <td>
                    <div className="max-w-md font-medium line-clamp-2">
                      {t.title}
                    </div>
                    <div className="text-xs text-base-content/60">
                      {t.channel ?? ''}
                    </div>
                  </td>
                  <td>{t.bpm != null ? Math.round(t.bpm) : '—'}</td>
                  <td>
                    <span className="badge badge-ghost badge-sm">
                      {t.keyCamelot ?? t.keyMusical ?? '—'}
                    </span>
                  </td>
                  <td>{formatDuration(t.durationSec)}</td>
                  <td className="text-right">
                    <a
                      className="btn btn-ghost btn-xs"
                      href={`/api/tracks/${t.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Preview
                    </a>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() =>
                        void postReanalyze(t.id).then(() => load())
                      }
                    >
                      Re-analyze
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() =>
                        void deleteTrack(t.id).then(() => {
                          setSelected((s) => {
                            const n = new Set(s)
                            n.delete(t.id)
                            return n
                          })
                          void load()
                        })
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
