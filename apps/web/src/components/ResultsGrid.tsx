import type { YoutubeSearchResultItem } from '../api/youtube-search'
import { formatDuration, formatViewCount } from '../lib/format'

type ResultsGridProps = {
  results: YoutubeSearchResultItem[]
  emptyHint: string
  selectedIds: Set<string>
  onToggleSelect: (videoId: string) => void
  onQuickDownload: (item: YoutubeSearchResultItem) => void
  onDownloadSelected: () => void
}

export function ResultsGrid({
  results,
  emptyHint,
  selectedIds,
  onToggleSelect,
  onQuickDownload,
  onDownloadSelected,
}: ResultsGridProps) {
  if (results.length === 0) {
    return (
      <div className="alert">
        <span>{emptyHint}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={selectedIds.size === 0}
          onClick={onDownloadSelected}
        >
          Download selected ({selectedIds.size})
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {results.map((item) => (
          <div key={item.videoId} className="card bg-base-100 shadow-xl">
            <figure className="bg-base-300 px-4 pt-4">
              {item.thumb ? (
                <img
                  src={item.thumb}
                  alt={item.title}
                  className="aspect-video w-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-base-300 text-sm text-base-content/60">
                  No thumbnail
                </div>
              )}
            </figure>
            <div className="card-body gap-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm mt-1"
                  checked={selectedIds.has(item.videoId)}
                  onChange={() => onToggleSelect(item.videoId)}
                  aria-label={`Select ${item.title}`}
                />
                <h3 className="card-title line-clamp-2 text-left text-base">
                  {item.title}
                </h3>
              </div>
              <p className="text-sm text-base-content/70">{item.channel}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="badge badge-ghost">
                  {formatDuration(item.durationSec)}
                </span>
                <span className="badge badge-ghost">
                  {formatViewCount(item.viewCount)} views
                </span>
                {item.publishedAt ? (
                  <span className="badge badge-ghost">{item.publishedAt}</span>
                ) : null}
              </div>
              <div className="card-actions flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onQuickDownload(item)}
                >
                  Quick download
                </button>
                <a
                  className="btn btn-ghost btn-sm"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  YouTube
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
