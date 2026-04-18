import { useEffect } from 'react'

import { fetchJobs } from '../api/downloads'
import { useQueueStore } from '../stores/queue-store'
import { useLibraryStore } from '../stores/library-store'
import type { JobRow } from '../types/jobs'

export function QueueStreamSubscriber() {
  const setJobs = useQueueStore((s) => s.setJobs)
  const applyJob = useQueueStore((s) => s.applyJob)
  const mergeJobsPayload = useQueueStore((s) => s.mergeJobsPayload)
  const loadLibrary = useLibraryStore((s) => s.load)

  useEffect(() => {
    let cancelled = false

    void fetchJobs()
      .then((jobs) => {
        if (!cancelled) setJobs(jobs)
      })
      .catch(() => {
        /* optional */
      })

    const es = new EventSource('/api/queue/stream')

    es.addEventListener('snapshot', (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data) as {
          jobs: JobRow[]
        }
        if (payload?.jobs) setJobs(payload.jobs)
      } catch {
        // ignore
      }
    })

    es.addEventListener('job', (ev) => {
      try {
        const job = JSON.parse((ev as MessageEvent).data) as JobRow
        applyJob(job)
      } catch {
        // ignore
      }
    })

    es.addEventListener('jobs', (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data) as {
          jobs: JobRow[]
        }
        if (payload?.jobs) mergeJobsPayload(payload.jobs)
      } catch {
        // ignore
      }
    })

    es.addEventListener('library', () => {
      void loadLibrary()
    })

    es.onerror = () => {
      es.close()
    }

    return () => {
      cancelled = true
      es.close()
    }
  }, [applyJob, loadLibrary, mergeJobsPayload, setJobs])

  return null
}
