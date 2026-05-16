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

const QUALITY_ORDER = ['best', '1080p60', '1080p', '720p60', '720p', '480p', '360p', '160p', 'audio_only', 'worst']

function sortQualities(qualities: string[]): string[] {
  return [...qualities].sort((a, b) => {
    const ai = QUALITY_ORDER.indexOf(a)
    const bi = QUALITY_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

/**
 * Queries streamlink for all available quality levels for a URL (--json).
 * Returns a sorted list; empty array on error.
 */
export function getAvailableQualities(url: string): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn(STREAMLINK_BIN, ['--json', url], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let out = ''
    proc.stdout?.on('data', (d: Buffer) => { out += d.toString() })
    proc.on('error', () => resolve([]))
    proc.on('exit', () => {
      try {
        const json = JSON.parse(out) as { streams?: Record<string, unknown> }
        const keys = Object.keys(json.streams ?? {})
        resolve(sortQualities(keys))
      } catch {
        resolve([])
      }
    })
  })
}

/**
 * Queries streamlink for the direct HLS URL of a stream or VOD.
 * Used for live streams (twitch.tv/<login>) and VODs (twitch.tv/videos/<id>).
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
      // Take the last line starting with https:// — skips info/warn lines from streamlink
      const hlsUrl = out.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('https://')).at(-1) ?? ''
      if (code === 0 && hlsUrl) {
        resolve(hlsUrl)
      } else {
        reject(new Error(`streamlink --stream-url ${url} ${quality} exit ${code}, stdout: ${out.trim().slice(0, 200)}`))
      }
    })
  })
}
