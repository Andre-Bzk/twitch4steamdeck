// Verschlüsselte Persistenz für Twitch-Tokens.
// Nutzt Electron safeStorage (OS-Keystore unter der Haube) — keine native Module nötig.

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
    // Fallback: unverschlüsselt (z. B. headless Linux ohne Keyring).
    // Datei nur für aktuellen User lesbar machen.
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
      // Datei evtl. mit anderem Key geschrieben — als ungültig behandeln.
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
