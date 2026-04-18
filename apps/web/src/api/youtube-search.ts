export type YoutubeSearchResultItem = {
  videoId: string
  title: string
  channel: string
  durationSec: number | null
  thumb: string | null
  viewCount: number | null
  publishedAt: string | null
  url: string
}

export type YoutubeSearchResponse = {
  results: YoutubeSearchResultItem[]
}

export type YoutubeSearchParams = {
  q: string
  max: number
  duration: 'any' | 'short' | 'medium' | 'long'
}

export async function fetchYoutubeSearch(
  params: YoutubeSearchParams,
): Promise<YoutubeSearchResponse> {
  const searchParams = new URLSearchParams({
    q: params.q,
    max: String(params.max),
    duration: params.duration,
  })
  const res = await fetch(`/api/youtube/search?${searchParams.toString()}`)
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const msg =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Search failed (${res.status})`
    throw new Error(msg)
  }
  if (
    !body ||
    typeof body !== 'object' ||
    !('results' in body) ||
    !Array.isArray((body as YoutubeSearchResponse).results)
  ) {
    throw new Error('Unexpected response from search API')
  }
  return body as YoutubeSearchResponse
}
