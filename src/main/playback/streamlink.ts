import { spawn, type ChildProcess } from 'node:child_process'
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

function resolveMpvBin(): string {
  if (process.platform === 'win32') {
    const candidates = [
      join(process.env.ProgramFiles ?? '', 'MPV Player', 'mpv.exe'),
      join(process.env.LOCALAPPDATA ?? '', 'Programs', 'mpv', 'mpv.exe'),
      join(process.env.LOCALAPPDATA ?? '', 'Programs', 'mpv-player', 'mpv.exe')
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
  }
  return 'mpv'
}

const STREAMLINK_BIN = resolveStreamlinkBin()
const MPV_BIN = resolveMpvBin()

/** Startet streamlink so dass es mpv als Player verwendet (für Live-Streams). */
export function spawnStreamlink(url: string, quality: string): ChildProcess {
  // --vo=gpu: Legacy-OpenGL-Renderer (gpu-next/libplacebo scheitert in Flatpak ohne Vulkan)
  // --hwdec=auto: VAAPI-Fallback auf SW-Dekodierung wenn nötig
  // --force-window=yes: Fenster auch bei vo-Init-Problemen erzwingen
  return spawn(
    STREAMLINK_BIN,
    ['--player', MPV_BIN, '--player-args', '--fullscreen --vo=gpu --hwdec=auto --force-window=yes', url, quality],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  )
}

/**
 * Fragt streamlink nach der direkten HLS-URL für einen VOD.
 * mpv kann diese URL dann nativ laden und darin seeked.
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
      const hlsUrl = out.trim()
      if (code === 0 && hlsUrl) {
        resolve(hlsUrl)
      } else {
        reject(new Error(`streamlink --stream-url exit ${code}`))
      }
    })
  })
}

export interface MpvOptions {
  ipcPath: string
}

/** Startet mpv direkt mit einer URL (HLS oder lokal). IPC-Socket wird gesetzt. */
export function spawnMpv(url: string, { ipcPath }: MpvOptions): ChildProcess {
  const args = [
    url,
    `--input-ipc-server=${ipcPath}`,
    '--fullscreen'
  ]
  return spawn(MPV_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] })
}
