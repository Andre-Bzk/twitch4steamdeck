// Encrypted persistence for Twitch tokens.
// Uses Electron safeStorage (OS keystore under the hood) — no native modules required.

import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

export interface StoredTokens {
  accessToken: string
  refreshToken: string
  /** Unix ms */
  expiresAt: number
  scopes: string[]
}

const FILE_NAME = 'twitch-tokens.bin'

function filePath(): string {
  return join(app.getPath('userData'), FILE_NAME)
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  const json = JSON.stringify(tokens)
  const path = filePath()

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json)
    await fs.writeFile(path, encrypted)
  } else {
    // Fallback: plaintext (e.g. headless Linux without a keyring).
    // Restrict file permissions to the current user.
    await fs.writeFile(path, json, { mode: 0o600 })
  }
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const path = filePath()
  let raw: Buffer
  try {
    raw = await fs.readFile(path)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }

  let json: string
  if (safeStorage.isEncryptionAvailable()) {
    try {
      json = safeStorage.decryptString(raw)
    } catch {
      // File may have been written with a different key — treat as invalid.
      return null
    }
  } else {
    json = raw.toString('utf8')
  }

  try {
    return JSON.parse(json) as StoredTokens
  } catch {
    return null
  }
}

export async function clearTokens(): Promise<void> {
  try {
    await fs.unlink(filePath())
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}
