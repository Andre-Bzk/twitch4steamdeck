import type { Messages } from './de'

// English message catalog. Typed against `Messages` (derived from de.ts) so the
// compiler flags any missing or extra keys.
export const en: Messages = {
  // ─── Common ─────────────────────────────────────────────────────────────
  'common.loading': 'Loading…',
  'common.tryAgain': 'Try again',
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.close': 'Close',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.refresh': 'Refresh',
  'common.channelPage': 'Channel page',
  'common.selection': 'Select',
  'common.live': 'Live',
  'common.loadError': 'Failed to load.',
  'common.offline': 'Offline',

  // ─── App / Error boundary ───────────────────────────────────────────────
  'app.error.title': 'An error occurred',
  'app.error.reload': 'Reload',
  'app.error.unknown': 'Unknown error',

  // ─── Quit dialog ────────────────────────────────────────────────────────
  'quit.title': 'Quit app?',
  'quit.message': 'Do you really want to close Twitch4SteamDeck?',

  // ─── Sidebar ────────────────────────────────────────────────────────────
  'nav.following': 'Following',
  'nav.browse': 'Browse',
  'nav.topStreamsDe': 'Top Streams DE',
  'nav.topStreamsEn': 'Top Streams EN',
  'nav.account': 'My account',
  'nav.settings': 'Settings',

  // ─── Login ──────────────────────────────────────────────────────────────
  'login.welcome': 'Welcome',
  'login.intro': 'Connect your Twitch account to see followed channels and VODs.',
  'login.connect': 'Connect with Twitch',
  'login.starting': 'Starting…',
  'login.notConfigured.title': 'Configuration missing',
  'login.notConfigured.body': 'No Twitch Client ID is configured. Create a .env file in the project root (see .env.example) and set MAIN_VITE_TWITCH_CLIENT_ID=…',
  'login.notConfigured.restart': 'Then restart npm run dev.',
  'login.openOnDevice': 'On another device, open',
  'login.enterCode': 'and enter the code:',
  'login.expiresIn': 'Code expires in {time}.',
  'login.error.accessDenied': 'Access denied.',
  'login.error.expired': 'Code expired — please try again.',
  'login.languageSelect': 'Language',

  // ─── Following ──────────────────────────────────────────────────────────
  'following.loading': 'Loading channels…',
  'following.loadError': 'Failed to load channels.',
  'following.empty': "You aren't following any channels yet.",
  'following.channelCount': '{count} channels',
  'following.liveCount': '● {count} live',

  // ─── Browse ─────────────────────────────────────────────────────────────
  'browse.topStreams': 'Top live streams',
  'browse.categories': 'Categories',
  'browse.openCategory': 'Open',
  'browse.backToStreams': 'Back to streams',
  'browse.viewersFull': '{count} viewers',
  'browse.loadingMore': 'Loading more…',

  // ─── Category ───────────────────────────────────────────────────────────
  'category.streamCount': '{count} streams',
  'category.loading': 'Loading streams…',
  'category.loadError': 'Failed to load streams.',
  'category.empty': 'No live streams in this category.',

  // ─── StreamList ─────────────────────────────────────────────────────────
  'streamList.empty': 'No live streams found for this language.',
  'streamList.loadingMore': 'Loading more streams…',
  'streamList.streamCount': '{count} streams',

  // ─── Channel ────────────────────────────────────────────────────────────
  'channel.watchLive': '▶ Watch live',
  'channel.startingPlayback': 'Starting playback…',
  'channel.playingHint': '● Playing',
  'channel.pausedSuffix': ' (Paused)',
  'channel.offline': 'Channel is currently offline.',
  'channel.viewers': '{count} viewers',
  'channel.pastStreams': 'Past streams',
  'channel.shelfPlay': 'Play',
  'channel.shelfChapter': 'Chapters',
  'channel.vodsLoading': 'Loading VODs…',
  'channel.vodsEmpty': 'No archived streams available.',
  'channel.vodPosition': '{position} of {duration}',
  'channel.unknownChapter': 'Unknown',

  // ─── Chapter Panel ──────────────────────────────────────────────────────
  'chapter.selectTitle': 'Select chapter',
  'chapter.navigate': 'Navigate',
  'chapter.jump': 'Jump',
  'chapter.start': 'Start',
  'chapter.loading': 'Loading chapters…',
  'chapter.empty': 'No chapters found.',
  'chapter.toResume': 'to resume.',
  'chapter.toStart': 'to jump to start.',
  'chapter.toPlay': 'to play.',

  // ─── Playback Overlay ───────────────────────────────────────────────────
  'playback.pause': 'Pause',
  'playback.resume': 'Resume',
  'playback.playLabel': 'Play',
  'playback.chapterLeft': 'Chapter ←',
  'playback.chapterRight': 'Chapter →',
  'playback.chapterMenu': 'Chapter menu',
  'playback.qualityHint': 'Quality',
  'playback.stop': 'Stop',
  'playback.openChapters': 'Open chapters',
  'playback.chapter': 'Chapter',
  'playback.startingOverlay': 'Starting playback…',
  'playback.closeHint': 'B / Esc — Close',

  // ─── Quality Panel ──────────────────────────────────────────────────────
  'quality.changeAria': 'Change quality',
  'quality.title': 'Quality',

  // ─── Account ────────────────────────────────────────────────────────────
  'account.title': 'My account',
  'account.loggedInTwitch': 'Logged in to Twitch',
  'account.loading': 'Loading account…',
  'account.loadError': 'Failed to load account data.',
  'account.appVersion': 'App version {version}',
  'account.confirmLogout': 'Really log out?',
  'account.logout': 'Log out',

  // ─── Settings ───────────────────────────────────────────────────────────
  'settings.title': 'Settings',
  'settings.language.title': 'Language',
  'settings.language.hint': 'Interface language. Applies immediately.',
  'settings.language.de': 'Deutsch',
  'settings.language.en': 'English',
  'settings.badge.title': 'Language indicator on stream cards',
  'settings.badge.hint': 'Twitch only reports the stream language — not the country. Flag mapping is an approximation based on the dominant Twitch user base (e.g. Portuguese → 🇧🇷 Brazil).',
  'settings.badge.off': 'Off',
  'settings.badge.previewOff': '— no badge',
  'settings.badge.lang': 'Language code only',
  'settings.badge.previewLang': 'e.g.  DE  EN  PT',
  'settings.badge.flag': 'Flag only',
  'settings.badge.previewFlag': 'e.g.  🇩🇪  🇺🇸  🇧🇷',
  'settings.badge.both': 'Both (flag + code)',
  'settings.badge.previewBoth': 'e.g.  🇩🇪 DE  🇺🇸 EN',
  'settings.sidebar.title': 'Sidebar width',
  'settings.sidebar.hint': 'Adjust the sidebar width ({min}–{max} px).',
  'settings.adjust': 'adjust',
  'settings.resetToDefault': 'resets to default ({value} px).',
  'settings.badgeGap.title': 'Flag badge spacing',
  'settings.badgeGap.hint': 'Spacing between menu text and the flag badge ({min}–{max} px).',
  'settings.storage.title': 'Storage',
  'settings.storage.hint': 'HLS segments (live & VODs) are single-use — they are never fetched again after playback. Caching causes unnecessary disk growth and battery drain on the Steam Deck. Thumbnails and API responses are always cached. Maximum cache size: 500 MB.',
  'settings.hlsCache.label': 'HLS cache (live & VODs)',
  'settings.hlsCache.on': 'Active — segments will be cached',
  'settings.hlsCache.off': 'Inactive — no disk growth (recommended)',
  'settings.cache.clearing': 'Clearing…',
  'settings.cache.clear': 'Clear cache',
  'settings.fileLog.label': 'File logging',
  'settings.fileLog.on': 'Active — info logs written to main.log',
  'settings.fileLog.off': 'Inactive — errors only (recommended)',

  // ─── Errors ─────────────────────────────────────────────────────────────
  'error.playbackFailed': 'Playback could not be started: {error}',
  'error.hlsUnsupported': 'HLS is not supported in this environment'
}
