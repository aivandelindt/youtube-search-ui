import { useQueueStore } from '../stores/queue-store'
import { postRetryJob, deleteJob } from '../api/downloads'
import type { JobRow, JobStatus } from '../types/jobs'

function badgeClass(status: JobStatus): string {
  switch (status) {
    case 'queued':
      return 'badge-ghost'
    case 'downloading':
      return 'badge-info'
    case 'converting':
      return 'badge-warning'
    case 'analyzing':
      return 'badge-secondary'
    case 'done':
      return 'badge-success'
    case 'failed':
      return 'badge-error'
    case 'cancelled':
      return 'badge-ghost'
    default:
      return 'badge-ghost'
  }
}

export function QueuePanel() {
  const jobs = useQueueStore((s) => s.jobs)

  return (
    <div className="overflow-x-auto rounded-box bg-base-100 shadow-xl">
      <table className="table table-zebra">
        <thead>
          <tr>
            <th>Title</th>
            <th>Format</th>
            <th>Status</th>
            <th>Progress</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {jobs.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center text-base-content/60">
                No jobs yet. Download tracks from Search.
              </td>
            </tr>
          ) : (
            jobs.map((job: JobRow) => (
              <tr key={job.id}>
                <td>
                  <div className="max-w-xs">
                    <div className="line-clamp-2 font-medium">{job.title}</div>
                    <div className="text-xs text-base-content/60">
                      {job.phase ?? ''}
                    </div>
                    {job.error ? (
                      <div className="tooltip" data-tip={job.error}>
                        <span className="text-xs text-error line-clamp-1">
                          {job.error}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className="uppercase">{job.settings.format}</td>
                <td>
                  <span className={`badge ${badgeClass(job.status)}`}>
                    {job.status}
                  </span>
                </td>
                <td>
                  {job.status === 'downloading' ||
                  job.status === 'converting' ||
                  job.status === 'analyzing' ? (
                    <progress
                      className="progress progress-info w-24"
                      value={job.progress}
                      max={100}
                    />
                  ) : (
                    <span className="text-sm">{Math.round(job.progress)}%</span>
                  )}
                </td>
                <td className="text-right">
                  {job.status === 'failed' ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => void postRetryJob(job.id)}
                    >
                      Retry
                    </button>
                  ) : null}
                  {job.status === 'queued' ||
                  job.status === 'downloading' ||
                  job.status === 'converting' ||
                  job.status === 'analyzing' ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => void deleteJob(job.id)}
                    >
                      Cancel
                    </button>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
