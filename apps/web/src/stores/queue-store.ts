import { create } from 'zustand'

import type { JobRow } from '../types/jobs'

function sortJobs(jobs: JobRow[]): JobRow[] {
  return [...jobs].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

type QueueState = {
  jobs: JobRow[]
  setJobs: (jobs: JobRow[]) => void
  applyJob: (job: JobRow) => void
  mergeJobsPayload: (jobs: JobRow[]) => void
}

export const useQueueStore = create<QueueState>((set) => ({
  jobs: [],
  setJobs: (jobs) => set({ jobs: sortJobs(jobs) }),
  applyJob: (job) =>
    set((s) => {
      const idx = s.jobs.findIndex((j) => j.id === job.id)
      const next =
        idx >= 0
          ? s.jobs.map((j) => (j.id === job.id ? job : j))
          : [job, ...s.jobs]
      return { jobs: sortJobs(next) }
    }),
  mergeJobsPayload: (incoming) =>
    set((s) => {
      const map = new Map(s.jobs.map((j) => [j.id, j]))
      for (const j of incoming) {
        map.set(j.id, j)
      }
      return { jobs: sortJobs([...map.values()]) }
    }),
}))
