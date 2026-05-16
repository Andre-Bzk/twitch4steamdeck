// Orchestrates the full Twitch login lifecycle and tracks current token status.

import { EventEmitter } from 'node:events'
import {
  pollForToken,
  refreshAccessToken,
  requestDeviceCode,
  type DeviceCodeResponse,
  type TokenResponse
} from './deviceCodeFlow'
import { clearTokens, loadTokens, saveTokens, type StoredTokens } from './tokenStore'

const SCOPES = ['user:read:follows'] as const
const REFRESH_SAFETY_MS = 60_000

export type AuthStatus = 'logged-out' | 'logged-in'

export interface DeviceFlowStartInfo {
  userCode: string
  verificationUri: string
  expiresInSec: number
}

export type AuthEvent =
  | { kind: 'authorized' }
  | { kind: 'denied' }
  | { kind: 'expired' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }

export class AuthService extends EventEmitter {
  private tokens: StoredTokens | null = null
  private currentFlow: AbortController | null = null

  constructor(private readonly clientId: string) {
    super()
  }

  async init(): Promise<void> {
    this.tokens = await loadTokens()
  }

  getStatus(): AuthStatus {
    return this.tokens ? 'logged-in' : 'logged-out'
  }

  isConfigured(): boolean {
    return this.clientId.length > 0
  }

  /**
   * Starts the Device Code Flow. Returns display data immediately
   * and polls in the background. Status changes are emitted as 'auth-event'.
   */
  async startDeviceFlow(): Promise<DeviceFlowStartInfo> {
    if (!this.isConfigured()) {
      throw new Error(
        'TWITCH_CLIENT_ID nicht gesetzt. Trage MAIN_VITE_TWITCH_CLIENT_ID in .env ein.'
      )
    }
    this.cancelFlow()

    const device: DeviceCodeResponse = await requestDeviceCode(this.clientId, SCOPES)
    const ctrl = new AbortController()
    this.currentFlow = ctrl

    void this.runPolling(device, ctrl.signal)

    return {
      userCode: device.user_code,
      verificationUri: device.verification_uri,
      expiresInSec: device.expires_in
    }
  }

  cancelFlow(): void {
    this.currentFlow?.abort()
    this.currentFlow = null
  }

  async logout(): Promise<void> {
    this.cancelFlow()
    this.tokens = null
    await clearTokens()
    this.emit('auth-event', { kind: 'cancelled' } satisfies AuthEvent)
  }

  /**
   * Returns a valid access token, refreshing it if necessary.
   * Used by the Helix client.
   */
  async getValidAccessToken(): Promise<string | null> {
    if (!this.tokens) return null
    if (this.tokens.expiresAt - REFRESH_SAFETY_MS > Date.now()) {
      return this.tokens.accessToken
    }
    try {
      const refreshed = await refreshAccessToken(this.clientId, this.tokens.refreshToken)
      this.tokens = tokenResponseToStored(refreshed)
      await saveTokens(this.tokens)
      return this.tokens.accessToken
    } catch {
      // Refresh failed — user must log in again.
      this.tokens = null
      await clearTokens()
      return null
    }
  }

  private async runPolling(device: DeviceCodeResponse, signal: AbortSignal): Promise<void> {
    const outcome = await pollForToken({
      clientId: this.clientId,
      scopes: SCOPES,
      deviceCode: device.device_code,
      intervalSec: device.interval,
      expiresInSec: device.expires_in,
      signal
    })

    if (outcome.kind === 'authorized') {
      this.tokens = tokenResponseToStored(outcome.token)
      await saveTokens(this.tokens)
      this.emit('auth-event', { kind: 'authorized' } satisfies AuthEvent)
    } else {
      this.emit('auth-event', outcome satisfies AuthEvent)
    }
  }
}

function tokenResponseToStored(t: TokenResponse): StoredTokens {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + t.expires_in * 1000,
    scopes: Array.isArray(t.scope) ? t.scope : []
  }
}
