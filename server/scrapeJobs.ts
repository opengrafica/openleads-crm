export type ScrapeJobState = {
  paused: boolean
  cancelled: boolean
  createdAt: number
}

const jobs = new Map<string, ScrapeJobState>()

export function createScrapeJob(id: string) {
  jobs.set(id, { paused: false, cancelled: false, createdAt: Date.now() })
  // limpa jobs antigos (>2h)
  const cutoff = Date.now() - 2 * 60 * 60 * 1000
  for (const [key, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(key)
  }
}

export function getScrapeJob(id: string | undefined | null) {
  if (!id) return null
  return jobs.get(id) ?? null
}

export function setScrapeJobPaused(id: string, paused: boolean) {
  const job = jobs.get(id)
  if (!job) return false
  job.paused = paused
  return true
}

export function cancelScrapeJob(id: string) {
  const job = jobs.get(id)
  if (!job) return false
  job.cancelled = true
  job.paused = false
  return true
}

export async function waitIfPaused(jobId: string | undefined, onPaused?: () => void) {
  if (!jobId) return
  let notified = false
  while (true) {
    const job = jobs.get(jobId)
    if (!job || job.cancelled) return
    if (!job.paused) return
    if (!notified) {
      onPaused?.()
      notified = true
    }
    await new Promise((r) => setTimeout(r, 400))
  }
}

export function isJobCancelled(jobId: string | undefined) {
  if (!jobId) return false
  return Boolean(jobs.get(jobId)?.cancelled)
}
