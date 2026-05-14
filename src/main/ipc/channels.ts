export const IPC = {
  appQuit: 'app:quit',
  authStatus: 'auth:get-status',
  authStart: 'auth:start-device-flow',
  authCancel: 'auth:cancel',
  authLogout: 'auth:logout',
  authConfigured: 'auth:is-configured',
  /** main → renderer */
  authEvent: 'auth:event',

  twitchGetFollowed: 'twitch:get-followed',
  twitchGetOwnUser: 'twitch:get-own-user',
  twitchGetVideos: 'twitch:get-videos',
  twitchGetTopGames: 'twitch:get-top-games',
  twitchGetTopStreams: 'twitch:get-top-streams',
  twitchGetVodChapters: 'twitch:get-vod-chapters',
  historyGetProgress: 'history:get-progress',

  playbackStartLive: 'playback:start-live',
  playbackStartVod: 'playback:start-vod',
  playbackStop: 'playback:stop',
  playbackPause: 'playback:pause',
  playbackReportPosition: 'playback:report-position',
  playbackGetQualities: 'playback:get-qualities',
  /** main → renderer */
  playbackEvent: 'playback:event',
  /** main → renderer: HLS-URL + Metadaten für den Renderer-seitigen Video-Player */
  playbackHlsUrl: 'playback:hls-url',

  appGetCacheSize: 'app:get-cache-size',
  appClearCache: 'app:clear-cache',
  appSetHlsCacheEnabled: 'app:set-hls-cache-enabled',

  /** main → renderer */
  gamepadInput: 'gamepad-input'
} as const
