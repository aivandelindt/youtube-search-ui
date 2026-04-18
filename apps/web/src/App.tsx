import { useEffect, useState } from 'react'

import { postDownloads } from './api/downloads'
import {
  fetchYoutubeSearch,
  type YoutubeSearchResultItem,
} from './api/youtube-search'
import { DownloadSettingsForm } from './components/DownloadSettingsForm'
import { LibraryPanel } from './components/LibraryPanel'
import { QueuePanel } from './components/QueuePanel'
import { QueueStreamSubscriber } from './components/QueueStreamSubscriber'
import { ResultsGrid } from './components/ResultsGrid'
import { SearchBar } from './components/SearchBar'
import { useDownloadSettingsStore } from './stores/download-settings-store'

type Tab = 'search' | 'queue' | 'library'

function App() {
  const [tab, setTab] = useState<Tab>('search')
  const [results, setResults] = useState<YoutubeSearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)

  const settings = useDownloadSettingsStore((s) => s.settings)

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const toggleSelect = (videoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(videoId)) next.delete(videoId)
      else next.add(videoId)
      return next
    })
  }

  const runDownload = async (items: YoutubeSearchResultItem[]) => {
    if (items.length === 0) return
    setToast(null)
    try {
      const res = await postDownloads(items, settings)
      const msg =
        res.deduped.length > 0
          ? `Queued ${res.jobIds.length} job(s), ${res.deduped.length} were already running.`
          : `Queued ${res.jobIds.length} job(s).`
      setToast(msg)
      setTab('queue')
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Enqueue failed'
      setError(m)
    }
  }

  return (
    <div className="min-h-screen bg-base-200">
      <QueueStreamSubscriber />
      {toast ? (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-success">
            <span>{toast}</span>
          </div>
        </div>
      ) : null}

      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <span className="btn btn-ghost text-xl">YouTube DJ Prep</span>
        </div>
        <div className="flex-none">
          <div className="join">
            <input
              type="radio"
              name="theme-buttons"
              className="theme-controller btn join-item btn-sm"
              aria-label="Dark"
              value="dark"
              defaultChecked
            />
            <input
              type="radio"
              name="theme-buttons"
              className="theme-controller btn join-item btn-sm"
              aria-label="Light"
              value="light"
            />
          </div>
        </div>
      </div>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div role="tablist" className="tabs tabs-boxed mb-6">
          <button
            type="button"
            role="tab"
            className={`tab ${tab === 'search' ? 'tab-active' : ''}`}
            onClick={() => setTab('search')}
          >
            Search
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${tab === 'queue' ? 'tab-active' : ''}`}
            onClick={() => setTab('queue')}
          >
            Queue
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${tab === 'library' ? 'tab-active' : ''}`}
            onClick={() => setTab('library')}
          >
            Library
          </button>
        </div>

        {tab === 'search' ? (
          <div className="flex flex-col gap-8">
            <DownloadSettingsForm />
            <SearchBar
              disabled={loading}
              onSubmit={async ({ query, max, duration }) => {
                setError(null)
                setLoading(true)
                try {
                  const data = await fetchYoutubeSearch({
                    q: query,
                    max,
                    duration,
                  })
                  setResults(data.results)
                  setSearched(true)
                  setSelectedIds(new Set())
                } catch (e) {
                  const msg = e instanceof Error ? e.message : 'Search failed'
                  setError(msg)
                  setResults([])
                } finally {
                  setLoading(false)
                }
              }}
            />

            {error ? (
              <div role="alert" className="alert alert-error">
                <span>{error}</span>
              </div>
            ) : null}

            <section aria-label="Search results">
              <h2 className="mb-4 text-lg font-semibold">Results</h2>
              <ResultsGrid
                results={results}
                emptyHint={
                  searched
                    ? 'No videos matched this query and filters.'
                    : 'No results yet. Run a search above.'
                }
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onQuickDownload={(item) => void runDownload([item])}
                onDownloadSelected={() => {
                  const items = results.filter((r) =>
                    selectedIds.has(r.videoId),
                  )
                  void runDownload(items)
                }}
              />
            </section>
          </div>
        ) : null}

        {tab === 'queue' ? (
          <section aria-label="Download queue">
            <h2 className="mb-4 text-lg font-semibold">Queue</h2>
            <QueuePanel />
          </section>
        ) : null}

        {tab === 'library' ? (
          <section aria-label="Library">
            <h2 className="mb-4 text-lg font-semibold">Library</h2>
            <LibraryPanel />
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default App
