// Twitch OAuth 2.0 Device Code Flow.
// Docs: https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#device-code-grant-flow

const DEVICE_ENDPOINT = 'https://id.twitch.tv/oauth2/device'
const TOKEN_ENDPOINT = 'https://id.twitch.tv/oauth2/token'

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string[]
  token_type: string
}

interface ErrorResponse {
  message?: string
  status?: number
}

export async function requestDeviceCode(
  clientId: string,
  scopes: readonly string[]
): Promise<DeviceCodeResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    scopes: scopes.join(' ')
  })
  const res = await fetch(DEVICE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) {
    throw new Error(`Device-Code-Request fehlgeschlagen (${res.status}): ${await res.text()}`)
  }
  return (await res.json()) as DeviceCodeResponse
}

export type PollOutcome =
  | { kind: 'authorized'; token: TokenResponse }
  | { kind: 'denied' }
  | { kind: 'expired' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }

interface PollOptions {
  clientId: string
  scopes: readonly string[]
  deviceCode: string
  intervalSec: number
  expiresInSec: number
  signal?: AbortSignal
}

export async function pollForToken(opts: PollOptions): Promise<PollOutcome> {
  const deadline = Date.now() + opts.expiresInSec * 1000
  let intervalMs = Math.max(1, opts.intervalSec) * 1000

  while (Date.now() < deadline) {
    if (opts.signal?.aborted) return { kind: 'cancelled' }
    await sleep(intervalMs, opts.signal)
    if (opts.signal?.aborted) return { kind: 'cancelled' }

    const body = new URLSearchParams({
      client_id: opts.clientId,
      scopes: opts.scopes.join(' '),
      device_code: opts.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    })

    let res: Response
    try {
      res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      })
    } catch (err) {
      return { kind: 'error', message: (err as Error).message }
    }

    if (res.ok) {
      const token = (await res.json()) as TokenResponse
      return { kind: 'authorized', token }
    }

    // Twitch returns a 400 with a message field while the code is pending.
    let payload: ErrorResponse = {}
    try {
      const json = (await res.json()) as unknown
      if (json && typeof json === 'object') {
        payload = json as ErrorResponse
      }
    } catch {
      /* non-JSON response, ignore */
    }
    const msg = (payload.message ?? '').toLowerCase()

    if (msg.includes('authorization_pending') || msg.includes('pending')) {
      continue
    }
    if (msg.includes('slow_down') || msg.includes('slow down')) {
      intervalMs += 5000
      continue
    }
    if (msg.includes('expired')) return { kind: 'expired' }
    if (msg.includes('denied') || msg.includes('access_denied')) return { kind: 'denied' }

    return { kind: 'error', message: payload.message ?? `HTTP ${res.status}` }
  }
  return { kind: 'expired' }
}

export async function refreshAccessToken(
  clientId: string,
  refreshToken: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  })
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) {
    throw new Error(`Token-Refresh fehlgeschlagen (${res.status}): ${await res.text()}`)
  }
  return (await res.json()) as TokenResponse
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(t)
      resolve()
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
