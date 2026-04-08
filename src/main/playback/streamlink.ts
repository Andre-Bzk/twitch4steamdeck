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

export interface StreamlinkOptions {
  url: string
  quality: string
  mpvIpcPath: string
  startSeconds?: number
}

export function spawnStreamlink({
  url,
  quality,
  mpvIpcPath,
  startSeconds
}: StreamlinkOptions): ChildProcess {
  const hwdec = process.platform === 'win32' ? 'auto' : 'vaapi'
  let playerArgs = `--input-ipc-server=${mpvIpcPath} --fullscreen --hwdec=${hwdec}`
  if (startSeconds && startSeconds > 0) {
    playerArgs += ` --start=${startSeconds}`
  }

  const args = [
    '--player',
    MPV_BIN,
    '--player-args',
    playerArgs,
    url,
    quality
  ]

  return spawn(STREAMLINK_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] })
}
