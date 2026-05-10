import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

function resolveStreamlinkBin(): string {
  if (process.platform === 'win32') {
    const candidates = [
      join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Streamlink', 'bin', 'streamlink.exe'),
      join(process.env.ProgramFiles ?? '', 'Streamlink', 'bin', 'streamlink.exe'),
      join(process.env['ProgramFiles(x86)'] ?? '', 'Streamlink', 'bin', 'streamlink.exe')
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
  }
  return 'streamlink'
}

const STREAMLINK_BIN = resolveStreamlinkBin()

/**
 * Fragt streamlink nach der direkten HLS-URL für einen Stream oder VOD.
 * Wird für Live-Streams (twitch.tv/<login>) und VODs (twitch.tv/videos/<id>) verwendet.
 */
export function getStreamUrl(url: string, quality: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(STREAMLINK_BIN, ['--stream-url', url, quality], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let out = ''
    proc.stdout?.on('data', (d: Buffer) => { out += d.toString() })
    proc.on('error', reject)
    proc.on('exit', (code) => {
      // Nimm die letzte Zeile die mit https:// beginnt — ignoriert Info-/Warn-Zeilen
      const hlsUrl = out.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('https://')).at(-1) ?? ''
      if (code === 0 && hlsUrl) {
        resolve(hlsUrl)
      } else {
        reject(new Error(`streamlink --stream-url exit ${code}, stdout: ${out.trim().slice(0, 200)}`))
      }
    })
  })
}
