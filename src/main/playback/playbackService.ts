import { EventEmitter } from 'node:events'
import { getAvailableQualities, getStreamUrl } from './streamlink'
import type { PlaybackEvent } from './types'
import * as history from '../store/historyRepo'

export interface HlsUrlPayload {
  url: string
  isLive: boolean
  startPosition: number
  durationSeconds: number
  vodId?: string
}

export class PlaybackService extends EventEmitter {
  async startLive(channelLogin: string, quality = 'best'): Promise<void> {
    let hlsUrl: string
    try {
      hlsUrl = await getStreamUrl(`twitch.tv/${channelLogin}`, quality)
    } catch (e) {
      this.emit('playback-event', {
        kind: 'error',
        message: `Stream-URL konnte nicht abgerufen werden: ${e}`
      } satisfies PlaybackEvent)
      return
    }
    this.emit('playback-hls-url', {
      url: hlsUrl,
      isLive: true,
      startPosition: 0,
      durationSeconds: 0
    } satisfies HlsUrlPayload)
    this.emit('playback-event', { kind: 'started', isLive: true } satisfies PlaybackEvent)
  }

  getAvailableQualities(twitchUrl: string): Promise<string[]> {
    return getAvailableQualities(twitchUrl)
  }

  async startVod(
    vodId: string,
    channelLogin: string,
    title: string,
    durationSeconds: number,
    startSeconds?: number,
    quality = 'best'
  ): Promise<void> {
    const resumePos = history.getPosition(vodId)
    history.upsertVod({
      vod_id: vodId,
      channel_login: channelLogin,
      title,
      duration_seconds: durationSeconds,
      watched_at: Date.now()
    })

    let hlsUrl: string
    try {
      hlsUrl = await getStreamUrl(`https://www.twitch.tv/videos/${vodId}`, quality)
    } catch (e) {
      this.emit('playback-event', {
        kind: 'error',
        message: `Stream-URL konnte nicht abgerufen werden: ${e}`
      } satisfies PlaybackEvent)
      return
    }

    const effectiveStart = startSeconds !== undefined ? startSeconds : resumePos
    this.emit('playback-hls-url', {
      url: hlsUrl,
      isLive: false,
      startPosition: effectiveStart,
      durationSeconds,
      vodId
    } satisfies HlsUrlPayload)
    this.emit('playback-event', { kind: 'started', durationSeconds, isLive: false } satisfies PlaybackEvent)
  }

  stop(): void {
    this.emit('playback-event', { kind: 'stopped' } satisfies PlaybackEvent)
  }

  updateVodPosition(vodId: string, positionSeconds: number, durationSeconds: number): void {
    const pos = Math.floor(positionSeconds)
    history.updatePosition(vodId, pos)
    if (durationSeconds > 0 && pos / durationSeconds > 0.95) {
      history.markCompleted(vodId)
    }
  }
}
