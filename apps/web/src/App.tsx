import { useState } from 'react'

import {
  fetchYoutubeSearch,
  type YoutubeSearchResultItem,
} from './api/youtube-search'
import { ResultsGrid } from './components/ResultsGrid'
import { SearchBar } from './components/SearchBar'

function App() {
  const [results, setResults] = useState<YoutubeSearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  return (
    <div className="min-h-screen bg-base-200">
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
        <div className="flex flex-col gap-8">
          <SearchBar
            disabled={loading}
            onSubmit={async ({ query, max, duration }) => {
              setError(null)
              setLoading(true)
              try {
                const data = await fetchYoutubeSearch({ q: query, max, duration })
                setResults(data.results)
                setSearched(true)
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
            />
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
