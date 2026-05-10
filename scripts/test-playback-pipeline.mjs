#!/usr/bin/env node
/**
 * Testet die Backend-Playback-Pipeline: streamlink → HLS-URL → Manifest-Fetch → Segment-Fetch
 *
 * Usage:
 *   node scripts/test-playback-pipeline.mjs twitch.tv/<kanal>
 *   node scripts/test-playback-pipeline.mjs twitch.tv/videos/<vod-id>
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const url = process.argv[2]
if (!url) {
  console.error('Usage: node scripts/test-playback-pipeline.mjs twitch.tv/<kanal>')
  process.exit(1)
}

function resolveStreamlinkBin() {
  if (process.platform === 'win32') {
    const candidates = [
      join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Streamlink', 'bin', 'streamlink.exe'),
      join(process.env.ProgramFiles ?? '', 'Streamlink', 'bin', 'streamlink.exe'),
      join(process.env['ProgramFiles(x86)'] ?? '', 'Streamlink', 'bin', 'streamlink.exe'),
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
  }
  return 'streamlink'
}

const STREAMLINK_BIN = resolveStreamlinkBin()

function pass(msg) { console.log(`  ✓ PASS  ${msg}`) }
function fail(msg) { console.log(`  ✗ FAIL  ${msg}`) }
function info(msg) { console.log(`  →       ${msg}`) }

async function run() {
  console.log(`\n=== Playback Pipeline Test ===`)
  console.log(`URL:        ${url}`)
  console.log(`Streamlink: ${STREAMLINK_BIN}`)
  console.log(`Streamlink existiert: ${existsSync(STREAMLINK_BIN)}`)
  console.log('')

  // Schritt 1: Streamlink aufrufen
  console.log('[1] Streamlink --stream-url aufrufen ...')
  const { rawOut, rawErr, code, hlsUrl } = await new Promise((resolve) => {
    const proc = spawn(STREAMLINK_BIN, ['--stream-url', url, 'best'], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let out = ''
    let err = ''
    proc.stdout?.on('data', (d) => { out += d.toString() })
    proc.stderr?.on('data', (d) => { err += d.toString() })
    proc.on('error', (e) => resolve({ rawOut: '', rawErr: String(e), code: -1, hlsUrl: '' }))
    proc.on('exit', (exitCode) => {
      const lines = out.split('\n').map(l => l.trim())
      const hlsUrl = lines.filter(l => l.startsWith('https://')).at(-1) ?? ''
      resolve({ rawOut: out, rawErr: err, code: exitCode, hlsUrl })
    })
  })

  info(`Exit-Code: ${code}`)
  info(`stdout (roh):\n${rawOut.trim() || '(leer)'}`)
  if (rawErr.trim()) info(`stderr: ${rawErr.trim().slice(0, 300)}`)

  if (code !== 0) {
    fail(`streamlink Exit-Code ${code}`)
    process.exit(1)
  }
  if (!hlsUrl) {
    fail('Keine https://-URL in stdout gefunden')
    process.exit(1)
  }
  pass(`HLS-URL gefunden: ${hlsUrl.slice(0, 80)}...`)

  // Schritt 2: Manifest fetchen
  console.log('\n[2] HLS-Manifest fetchen ...')
  let manifestText = ''
  try {
    const res = await fetch(hlsUrl, {
      headers: {
        'Origin': 'https://www.twitch.tv',
        'Referer': 'https://www.twitch.tv/'
      }
    })
    info(`HTTP Status: ${res.status}`)
    manifestText = await res.text()
    info(`Manifest (erste 200 Zeichen):\n${manifestText.slice(0, 200)}`)

    if (!manifestText.startsWith('#EXTM3U')) {
      fail('Antwort ist kein valides m3u8 (fehlt #EXTM3U)')
      process.exit(1)
    }
    pass('#EXTM3U vorhanden — valides HLS-Manifest')
  } catch (e) {
    fail(`Manifest-Fetch fehlgeschlagen: ${e}`)
    process.exit(1)
  }

  // Schritt 3: Erstes Segment erreichbar?
  console.log('\n[3] Erstes Segment erreichbar? ...')
  const baseUrl = hlsUrl.substring(0, hlsUrl.lastIndexOf('/') + 1)
  const segmentLine = manifestText.split('\n').find(l => l.trim() && !l.startsWith('#'))
  if (!segmentLine) {
    // Möglicherweise Master-Playlist → Sub-Playlist URL suchen
    const subPlaylistLine = manifestText.split('\n').find(l => l.trim().startsWith('https://'))
    if (subPlaylistLine) {
      info(`Master-Playlist erkannt — Sub-Playlist: ${subPlaylistLine.trim().slice(0, 80)}`)
      pass('Master-Playlist vorhanden (Sub-Playlists nicht weiter verfolgt)')
    } else {
      fail('Keine Segmente oder Sub-Playlists im Manifest gefunden')
    }
  } else {
    const segmentUrl = segmentLine.startsWith('https://') ? segmentLine.trim() : `${baseUrl}${segmentLine.trim()}`
    info(`Segment-URL: ${segmentUrl.slice(0, 80)}`)
    try {
      const segRes = await fetch(segmentUrl, { method: 'HEAD' })
      info(`Segment HTTP Status: ${segRes.status}`)
      if (segRes.ok) {
        pass(`Erstes Segment erreichbar (HTTP ${segRes.status})`)
      } else {
        fail(`Erstes Segment HTTP ${segRes.status}`)
      }
    } catch (e) {
      fail(`Segment-Fetch fehlgeschlagen: ${e}`)
    }
  }

  console.log('\n=== Test abgeschlossen ===\n')
}

run().catch((e) => {
  console.error('Unerwarteter Fehler:', e)
  process.exit(1)
})
