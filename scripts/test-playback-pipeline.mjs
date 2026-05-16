#!/usr/bin/env node
/**
 * Testet die Backend-Playback-Pipeline: streamlink → HLS-URL → Manifest-Fetch → Segment-Fetch
 * Tests the backend playback pipeline: streamlink → HLS URL → manifest fetch → segment fetch
 *
 * Usage:
 *   node scripts/test-playback-pipeline.mjs twitch.tv/<channel>
 *   node scripts/test-playback-pipeline.mjs twitch.tv/videos/<vod-id>
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const url = process.argv[2]
if (!url) {
  console.error('Usage: node scripts/test-playback-pipeline.mjs twitch.tv/<channel>')
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
  console.log(`Streamlink exists: ${existsSync(STREAMLINK_BIN)}`)
  console.log('')

  // Schritt 1: Streamlink aufrufen
  // Step 1: invoke Streamlink
  console.log('[1] Running Streamlink --stream-url ...')
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

  info(`Exit code: ${code}`)
  info(`stdout (raw):\n${rawOut.trim() || '(empty)'}`)
  if (rawErr.trim()) info(`stderr: ${rawErr.trim().slice(0, 300)}`)

  if (code !== 0) {
    fail(`streamlink exit code ${code}`)
    process.exit(1)
  }
  if (!hlsUrl) {
    fail('No https:// URL found in stdout')
    process.exit(1)
  }
  pass(`Found HLS URL: ${hlsUrl.slice(0, 80)}...`)

  // Schritt 2: Manifest fetchen
  // Step 2: fetch the manifest
  console.log('\n[2] Fetching HLS manifest ...')
  let manifestText = ''
  try {
    const res = await fetch(hlsUrl, {
      headers: {
        'Origin': 'https://www.twitch.tv',
        'Referer': 'https://www.twitch.tv/'
      }
    })
    info(`HTTP status: ${res.status}`)
    manifestText = await res.text()
    info(`Manifest (first 200 chars):\n${manifestText.slice(0, 200)}`)

    if (!manifestText.startsWith('#EXTM3U')) {
      fail('Response is not a valid m3u8 (missing #EXTM3U)')
      process.exit(1)
    }
    pass('#EXTM3U present - valid HLS manifest')
  } catch (e) {
    fail(`Manifest fetch failed: ${e}`)
    process.exit(1)
  }

  // Schritt 3: Erstes Segment erreichbar?
  // Step 3: is the first segment reachable?
  console.log('\n[3] Is the first segment reachable? ...')
  const baseUrl = hlsUrl.substring(0, hlsUrl.lastIndexOf('/') + 1)
  const segmentLine = manifestText.split('\n').find(l => l.trim() && !l.startsWith('#'))
  if (!segmentLine) {
    // Möglicherweise Master-Playlist → Sub-Playlist URL suchen
    // Possibly a master playlist -> look for a sub-playlist URL
    const subPlaylistLine = manifestText.split('\n').find(l => l.trim().startsWith('https://'))
    if (subPlaylistLine) {
      info(`Detected master playlist - sub-playlist: ${subPlaylistLine.trim().slice(0, 80)}`)
      pass('Master playlist present (sub-playlists not followed further)')
    } else {
      fail('No segments or sub-playlists found in manifest')
    }
  } else {
    const segmentUrl = segmentLine.startsWith('https://') ? segmentLine.trim() : `${baseUrl}${segmentLine.trim()}`
    info(`Segment URL: ${segmentUrl.slice(0, 80)}`)
    try {
      const segRes = await fetch(segmentUrl, { method: 'HEAD' })
      info(`Segment HTTP status: ${segRes.status}`)
      if (segRes.ok) {
        pass(`First segment is reachable (HTTP ${segRes.status})`)
      } else {
        fail(`First segment returned HTTP ${segRes.status}`)
      }
    } catch (e) {
      fail(`Segment fetch failed: ${e}`)
    }
  }

  console.log('\n=== Test completed ===\n')
}

run().catch((e) => {
  console.error('Unexpected error:', e)
  process.exit(1)
})
