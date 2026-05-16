// German message catalog. Source of truth for the key set — any new translation
// key must be added here first; en.ts is typed against `MessageKey` and will
// fail to compile if a key is missing.
export const de = {
  // ─── Common ─────────────────────────────────────────────────────────────
  'common.loading': 'Lade…',
  'common.tryAgain': 'Erneut versuchen',
  'common.back': 'Zurück',
  'common.cancel': 'Abbrechen',
  'common.confirm': 'Bestätigen',
  'common.close': 'Schließen',
  'common.yes': 'Ja',
  'common.no': 'Nein',
  'common.refresh': 'Aktualisieren',
  'common.channelPage': 'Kanalseite',
  'common.selection': 'Auswahl',
  'common.live': 'Live',
  'common.loadError': 'Fehler beim Laden.',
  'common.offline': 'Offline',

  // ─── App / Error boundary ───────────────────────────────────────────────
  'app.error.title': 'Ein Fehler ist aufgetreten',
  'app.error.reload': 'Neu laden',
  'app.error.unknown': 'Unbekannter Fehler',

  // ─── Quit dialog ────────────────────────────────────────────────────────
  'quit.title': 'App beenden?',
  'quit.message': 'Möchtest du Twitch4SteamDeck wirklich schließen?',

  // ─── Sidebar ────────────────────────────────────────────────────────────
  'nav.following': 'Du folgst',
  'nav.browse': 'Durchsuchen',
  'nav.topStreamsDe': 'Top Streams DE',
  'nav.topStreamsEn': 'Top Streams EN',
  'nav.account': 'Mein Account',
  'nav.settings': 'Einstellungen',

  // ─── Login ──────────────────────────────────────────────────────────────
  'login.welcome': 'Willkommen',
  'login.intro': 'Verbinde deinen Twitch-Account, um gefolgte Kanäle und VODs zu sehen.',
  'login.connect': 'Mit Twitch verbinden',
  'login.starting': 'Starte…',
  'login.notConfigured.title': 'Konfiguration fehlt',
  'login.notConfigured.body': 'Es ist keine Twitch Client ID hinterlegt. Lege im Projektverzeichnis eine Datei .env an (siehe .env.example) und setze MAIN_VITE_TWITCH_CLIENT_ID=…',
  'login.notConfigured.restart': 'Danach npm run dev neu starten.',
  'login.openOnDevice': 'Öffne auf einem anderen Gerät',
  'login.enterCode': 'und gib den Code ein:',
  'login.expiresIn': 'Code läuft in {time} ab.',
  'login.error.accessDenied': 'Zugriff abgelehnt.',
  'login.error.expired': 'Code abgelaufen — bitte erneut versuchen.',
  'login.languageSelect': 'Sprachauswahl',

  // ─── Following ──────────────────────────────────────────────────────────
  'following.loading': 'Lade Kanäle…',
  'following.loadError': 'Fehler beim Laden der Kanäle.',
  'following.empty': 'Du folgst noch keinen Kanälen.',
  'following.channelCount': '{count} Kanäle',
  'following.liveCount': '● {count} live',

  // ─── Browse ─────────────────────────────────────────────────────────────
  'browse.topStreams': 'Top Live-Streams',
  'browse.categories': 'Kategorien',
  'browse.openCategory': 'Öffnen',
  'browse.backToStreams': 'Zurück zu Streams',
  'browse.viewersFull': '{count} Zuschauer',
  'browse.loadingMore': 'Lade weitere…',

  // ─── Category ───────────────────────────────────────────────────────────
  'category.streamCount': '{count} Streams',
  'category.loading': 'Lade Streams…',
  'category.loadError': 'Fehler beim Laden der Streams.',
  'category.empty': 'Keine Live-Streams in dieser Kategorie.',

  // ─── StreamList ─────────────────────────────────────────────────────────
  'streamList.empty': 'Keine Live-Streams für diese Sprache gefunden.',
  'streamList.loadingMore': 'Lade weitere Streams…',
  'streamList.streamCount': '{count} Streams',

  // ─── Channel ────────────────────────────────────────────────────────────
  'channel.watchLive': '▶ Live ansehen',
  'channel.startingPlayback': 'Starte Wiedergabe…',
  'channel.playingHint': '● Wiedergabe',
  'channel.pausedSuffix': ' (Pause)',
  'channel.offline': 'Kanal ist gerade offline.',
  'channel.viewers': '{count} Zuschauer',
  'channel.pastStreams': 'Vergangene Streams',
  'channel.shelfPlay': 'Abspielen',
  'channel.shelfChapter': 'Kapitel',
  'channel.vodsLoading': 'Lade VODs…',
  'channel.vodsEmpty': 'Keine archivierten Streams verfügbar.',
  'channel.vodPosition': '{position} von {duration}',
  'channel.unknownChapter': 'Unbekannt',

  // ─── Chapter Panel ──────────────────────────────────────────────────────
  'chapter.selectTitle': 'Kapitel wählen',
  'chapter.navigate': 'Navigieren',
  'chapter.jump': 'Springen',
  'chapter.start': 'Starten',
  'chapter.loading': 'Lade Kapitel…',
  'chapter.empty': 'Keine Kapitel gefunden.',
  'chapter.toResume': 'zum Fortsetzen.',
  'chapter.toStart': 'zum Anfang springen.',
  'chapter.toPlay': 'zum Abspielen.',

  // ─── Playback Overlay ───────────────────────────────────────────────────
  'playback.pause': 'Pause',
  'playback.resume': 'Fortsetzen',
  'playback.playLabel': 'Wiedergabe',
  'playback.chapterLeft': 'Kapitel ←',
  'playback.chapterRight': 'Kapitel →',
  'playback.chapterMenu': 'Kapitelmenü',
  'playback.qualityHint': 'Qualität',
  'playback.stop': 'Stop',
  'playback.openChapters': 'Kapitel öffnen',
  'playback.chapter': 'Kapitel',
  'playback.startingOverlay': 'Starte Wiedergabe…',
  'playback.closeHint': 'B / Esc — Schließen',

  // ─── Quality Panel ──────────────────────────────────────────────────────
  'quality.changeAria': 'Qualität ändern',
  'quality.title': 'Qualität',

  // ─── Account ────────────────────────────────────────────────────────────
  'account.title': 'Mein Account',
  'account.loggedInTwitch': 'Eingeloggt bei Twitch',
  'account.loading': 'Lade Account…',
  'account.loadError': 'Accountdaten konnten nicht geladen werden.',
  'account.appVersion': 'App-Version {version}',
  'account.confirmLogout': 'Wirklich abmelden?',
  'account.logout': 'Abmelden',

  // ─── Settings ───────────────────────────────────────────────────────────
  'settings.title': 'Einstellungen',
  'settings.language.title': 'Sprache',
  'settings.language.hint': 'Sprache der Benutzeroberfläche. Wirkt sofort.',
  'settings.language.de': 'Deutsch',
  'settings.language.en': 'English',
  'settings.badge.title': 'Sprach-Anzeige auf Stream-Karten',
  'settings.badge.hint': 'Twitch liefert nur die Stream-Sprache — kein Land. Flaggen-Zuordnung ist eine Annäherung basierend auf der dominanten Twitch-Nutzerbase (z.B. Portugiesisch → 🇧🇷 Brasilien).',
  'settings.badge.off': 'Aus',
  'settings.badge.previewOff': '— kein Badge',
  'settings.badge.lang': 'Nur Sprach-Kürzel',
  'settings.badge.previewLang': 'z.B.  DE  EN  PT',
  'settings.badge.flag': 'Nur Flagge',
  'settings.badge.previewFlag': 'z.B.  🇩🇪  🇺🇸  🇧🇷',
  'settings.badge.both': 'Beides (Flagge + Kürzel)',
  'settings.badge.previewBoth': 'z.B.  🇩🇪 DE  🇺🇸 EN',
  'settings.sidebar.title': 'Sidebar-Breite',
  'settings.sidebar.hint': 'Breite der Seitenleiste anpassen ({min}–{max} px).',
  'settings.adjust': 'verschieben',
  'settings.resetToDefault': 'setzt auf Standard ({value} px) zurück.',
  'settings.badgeGap.title': 'Flaggen-Badge Abstand',
  'settings.badgeGap.hint': 'Abstand zwischen Menütext und Flaggen-Badge ({min}–{max} px).',
  'settings.storage.title': 'Speicher',
  'settings.storage.hint': 'HLS-Segmente (Live & VODs) sind Single-Use — sie werden nach dem Abspielen nie wieder abgerufen. Caching erzeugt auf dem Steam Deck unnötiges Disk-Wachstum und Akku-Belastung. Thumbnails und API-Antworten bleiben immer gecacht. Maximale Cache-Größe: 500 MB.',
  'settings.hlsCache.label': 'HLS-Cache (Live & VODs)',
  'settings.hlsCache.on': 'Aktiv — Segmente werden gecacht',
  'settings.hlsCache.off': 'Inaktiv — kein Disk-Wachstum (empfohlen)',
  'settings.cache.clearing': 'Wird geleert …',
  'settings.cache.clear': 'Cache leeren',
  'settings.fileLog.label': 'Datei-Logging',
  'settings.fileLog.on': 'Aktiv — Info-Logs in main.log',
  'settings.fileLog.off': 'Inaktiv — nur Fehler werden geloggt (empfohlen)',

  // ─── Errors ─────────────────────────────────────────────────────────────
  'error.playbackFailed': 'Wiedergabe konnte nicht gestartet werden: {error}',
  'error.hlsUnsupported': 'HLS wird in dieser Umgebung nicht unterstützt'
}

export type MessageKey = keyof typeof de
export type Messages = Record<MessageKey, string>
