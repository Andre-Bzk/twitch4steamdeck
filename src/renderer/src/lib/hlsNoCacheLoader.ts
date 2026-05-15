import type { HlsConfig, LoaderCallbacks, LoaderConfiguration, LoaderContext, LoaderStats } from 'hls.js'

function makeStats(): LoaderStats {
  return {
    aborted: false,
    loaded: 0,
    retry: 0,
    total: 0,
    chunkCount: 0,
    bwEstimate: 0,
    loading: { start: 0, first: 0, end: 0 },
    parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 },
  }
}

// Custom hls.js loader using fetch() with cache: 'no-store'.
// XHR-based approaches (xhrSetup, onBeforeSendHeaders, onHeadersReceived) cannot reliably
// prevent Chromium's HTTP disk cache from storing responses — only the Fetch API's
// cache mode is evaluated before the cache storage decision is made.
export class NoCacheLoader {
  context: LoaderContext | null = null
  stats: LoaderStats = makeStats()

  private controller: AbortController | null = null

  // hls.js instantiates loaders via `new config.loader(config)` — we ignore the config arg
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: HlsConfig) {}

  load(context: LoaderContext, _config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>): void {
    this.context = context
    this.controller = new AbortController()
    this.stats = makeStats()
    this.stats.loading.start = performance.now()

    const headers: Record<string, string> = { ...(context.headers ?? {}) }
    if (context.rangeEnd) {
      headers['Range'] = `bytes=${context.rangeStart ?? 0}-${context.rangeEnd - 1}`
    }

    fetch(context.url, { cache: 'no-store', signal: this.controller.signal, headers })
      .then((response) => {
        if (!response.ok) {
          callbacks.onError(
            { code: response.status, text: response.statusText },
            context,
            response,
            this.stats,
          )
          return
        }
        this.stats.loading.first = performance.now()
        this.stats.total = parseInt(response.headers.get('content-length') ?? '0', 10) || 0

        const dataPromise: Promise<string | ArrayBuffer> =
          context.responseType === 'arraybuffer' ? response.arrayBuffer() : response.text()

        return dataPromise.then((data) => {
          this.stats.loaded =
            typeof data === 'string' ? data.length : (data as ArrayBuffer).byteLength
          this.stats.loading.end = performance.now()
          callbacks.onSuccess({ url: response.url, data }, this.stats, context, response)
        })
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        callbacks.onError(
          { code: 0, text: err instanceof Error ? err.message : String(err) },
          context,
          null,
          this.stats,
        )
      })
  }

  abort(): void {
    this.stats.aborted = true
    this.controller?.abort()
  }

  destroy(): void {
    this.abort()
    this.context = null
  }
}
