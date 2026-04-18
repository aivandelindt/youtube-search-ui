type DurationFilter = 'any' | 'short' | 'medium' | 'long'

export type SearchBarSubmit = {
  query: string
  max: number
  duration: DurationFilter
}

type SearchBarProps = {
  disabled?: boolean
  onSubmit: (values: SearchBarSubmit) => void
}

const durationOptions: { value: DurationFilter; label: string }[] = [
  { value: 'any', label: 'Any length' },
  { value: 'short', label: 'Short (<4 min)' },
  { value: 'medium', label: 'Medium (4–20 min)' },
  { value: 'long', label: 'Long (>20 min)' },
]

export function SearchBar({ disabled, onSubmit }: SearchBarProps) {
  return (
    <form
      className="card bg-base-100 shadow-xl"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const fd = new FormData(form)
        const query = String(fd.get('q') ?? '').trim()
        const max = Number(fd.get('max') ?? 10)
        const duration = fd.get('duration') as DurationFilter
        if (!query) return
        onSubmit({ query, max, duration })
      }}
    >
      <div className="card-body gap-4">
        <h2 className="card-title">Search YouTube</h2>
        <label className="form-control w-full">
          <span className="label-text">Query</span>
          <input
            name="q"
            type="search"
            required
            disabled={disabled}
            placeholder="Artist, track, set…"
            className="input input-bordered w-full"
          />
        </label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="form-control w-full">
            <span className="label-text">Max results</span>
            <select
              name="max"
              defaultValue="10"
              disabled={disabled}
              className="select select-bordered"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </label>
          <label className="form-control w-full">
            <span className="label-text">Duration</span>
            <select
              name="duration"
              defaultValue="any"
              disabled={disabled}
              className="select select-bordered"
            >
              {durationOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="card-actions justify-end">
          <button
            type="submit"
            className={`btn btn-primary ${disabled ? 'loading' : ''}`}
            disabled={disabled}
          >
            Search
          </button>
        </div>
      </div>
    </form>
  )
}
