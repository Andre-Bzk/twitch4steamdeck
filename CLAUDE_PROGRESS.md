# Twitch4SteamDeck — Fortschritts-Snapshot

> Stand: **2026-04-09 (Session 5)**. Diese Datei dient als Übergabe zwischen Sessions.
> **Lies zuerst:** diese Datei + `todo.md` + `plan.md`.

**Aktueller Stand:** Phase 0–5.6 abgeschlossen & verifiziert. Phase 6 (Flatpak-Packaging): Manifest + Hilfs-Dateien geschrieben, wartet auf User-Verifikation in WSL2 + Steam Deck.

---

## Bereits abgeschlossen

### ✅ Phase 0 — Projekt-Skelett
### ✅ Phase 1 — Twitch OAuth Device Code Flow
### ✅ Phase 2 — Twitch Helix-Client + Sidebar-Layout
Alle drei End-to-End verifiziert 2026-04-07.

---

### ✅ Phase 3 — Streamlink + mpv (Live-Wiedergabe)

Verifiziert 2026-04-08.

#### Architektur-Entscheidungen:
- `--twitch-api-header` wird **nicht** übergeben — Twitch lehnt den Device-Code-Token für
  streamlinks interne GQL-API ab. Öffentliche Streams funktionieren ohne Auth-Header.
- `resolveMpvBin()` löst den mpv-Pfad explizit auf (`C:\Program Files\MPV Player\mpv.exe`),
  da Electron den User-PATH nicht vollständig erbt.
- `--twitch-disable-ads` ist von streamlink deaktiviert worden (deprecated) — kein Ad-Bypass
  im Moment. Post-MVP-Problem.

---

### ✅ Phase 4 — VOD-Browsing + -Wiedergabe

Verifiziert 2026-04-08.

#### Architektur-Entscheidungen:
- **VODs:** streamlink `--stream-url` liefert HLS-URL → mpv wird **direkt** mit der URL
  gespawnt (nicht via `--player`-Flag). Grund: Piped-Streams sind nicht seekable.
  Direktes mpv-Spawnen ermöglicht Seeking + funktionierendes IPC.
- **Live-Streams:** weiterhin via `--player mpv --player-args "--fullscreen"`. Kein IPC
  nötig (kein Seeking, kein Position-Tracking bei Live).
- VOD-Shelf im `ChannelScreen` (untere Hälfte, horizontal, oberer Hero-Bereich fix).
  Navigation: ↓ → Shelf, ←/→ zwischen VODs, ↑ → zurück, Enter → abspielen.

---

### ✅ Phase 5 — Lokaler VOD-Verlauf (Resume)

Verifiziert 2026-04-08.

#### Neue Dateien:
- `src/main/store/db.ts` — SQLite via better-sqlite3, WAL-Modus, Migration
- `src/main/store/historyRepo.ts` — `upsertVod`, `updatePosition`, `markCompleted`,
  `getPosition`, `getProgressMap`

#### Architektur-Entscheidungen:
- mpv IPC funktioniert jetzt zuverlässig (da mpv direkt gespawnt wird).
  `MpvController.observeTimePos()` parst eingehende JSON-Lines, Throttling auf 5s.
- Resume-Position wird beim `startVod()`-Aufruf automatisch aus DB gelesen.
- Auto-Complete bei >95% Fortschritt.
- `„Continue Watching"-Reihe` wurde bewusst weggelassen (vom User nicht gewünscht).
- VOD-Karte zeigt: Fortschrittsbalken (lila), `0:16 von 6:22`, `Vor X Min.`,
  Completed-Overlay mit Kreis-Checkmark.

---

### ✅ Phase 5.5 — Browse-Menü: Kategorien + Top Live-Streams

Verifiziert 2026-04-08.

#### Neue/geänderte Dateien:
- `src/main/twitch/types.ts` — `HelixGame`, `GameInfo`, `game_id`+`language` in `HelixStream`
- `src/main/twitch/helixClient.ts` — `getTopGames(limit, cursor?)`, `getTopStreams(opts?)`
- `src/main/ipc/handlers.ts` — `twitch:get-top-games`, `twitch:get-top-streams`
- `src/preload/index.ts` — `GameInfo`-Typ + neue API-Methoden
- `src/renderer/src/types/t4sd.d.ts` — `GameInfo`, T4sdApi erweitert
- `src/renderer/src/input/gamepad.ts` — Button 2 (X) → `'x'`, Button 3 (Y) → `'y'`
- `src/renderer/src/screens/BrowseScreen.tsx` — Shelf (Top Live) + Kategorien-Grid
- `src/renderer/src/screens/CategoryScreen.tsx` — neu: Streams-Grid pro Kategorie
- `src/renderer/src/screens/AppShell.tsx` — `selectedCategory`-Routing

#### Key-Mapping Browse + Category:
- **Enter / A**: Stream → direkt Live starten · Kategorie → Drilldown
- **X**: Stream-Karte → ChannelScreen öffnen (VOD-Shelf + Live-Button)
- **Y**: Refresh
- **Escape / B**: Category → zurück zu Browse · Browse → Sidebar

#### Wichtige Implementierungsdetails:
- `getTopGames()` macht 40 parallele `/streams?game_id=<id>&first=100` Calls für Zuschauerzahlen
  (Top-100-Streams pro Kategorie summiert → ~85-95% Genauigkeit vs. Twitch-Website).
- Pagination: `getTopGames()` gibt `{ games, cursor }` zurück. BrowseScreen lädt automatisch
  nächste 40 Kategorien wenn letztes Grid-Element fokussiert wird.
- `getTopStreams()` global mit `limit: 100` für den Shelf.
- Zuschauerzahlen auf Kategorien zeigen `n.toLocaleString('de-DE')` Format.

---

### ✅ Phase 5.6 — Einstellungen-Menü + Sprach-Badge/Flagge

Verifiziert 2026-04-08.

#### Neue Dateien:
- `src/renderer/src/context/SettingsContext.tsx` — `SettingsProvider`, `useSettings()` Hook,
  localStorage-Persistenz (`t4sd:settings`), Fallback auf Default bei korrupten Werten
- `src/renderer/src/components/LanguageBadge.tsx` — rendert Badge/Flagge/Beides je nach Mode;
  38 Sprachen gemappt (pragmatische Twitch-Dominanz-Zuordnung)
- `src/renderer/src/screens/SettingsScreen.tsx` — 4 Optionen, gamepad-navigierbar

#### Geänderte Dateien:
- `src/main/twitch/types.ts` — `language` in `HelixStream` + `FollowedChannelInfo`
- `src/main/twitch/helixClient.ts` — `language` in beiden Stream-Mappern
- `src/preload/index.ts` + `t4sd.d.ts` — `language?: string` in `FollowedChannelInfo`
- `src/renderer/src/components/Icons.tsx` — `SettingsIcon` (Zahnrad)
- `src/renderer/src/components/Sidebar.tsx` — 4. Tab `'settings'`
- `src/renderer/src/components/FocusableCard.tsx` — `<LanguageBadge>` unten-rechts im Thumb
- `src/renderer/src/screens/BrowseScreen.tsx` — `<LanguageBadge>` in Shelf-Cards
- `src/renderer/src/screens/AppShell.tsx` — `tab === 'settings'` → SettingsScreen
- `src/renderer/src/main.tsx` — `<SettingsProvider>` um App

#### Architektur-Entscheidungen:
- Settings in `localStorage` (nicht SQLite) — reine UI-Präferenz, kein IPC nötig,
  synchron lesbar (kein Flicker beim Start).
- Default-Mode: `'language'` (Kürzel wie DE/EN) — funktioniert auf Windows Dev-Host sicher.
  Flaggen-Emojis (Unicode Regional Indicators) werden erst auf Steam Deck (Linux/Noto Emoji)
  korrekt gerendert — auf Windows Dev-Host ggf. Rechtecke statt Flaggen.
- `StreamBadgeMode`: `'off' | 'language' | 'flag' | 'both'`
- LanguageBadge Position: `bottom: 10px; right: 10px` im Thumbnail (gegenüber Viewer-Count
  unten-links). Font-Size 15px (FocusableCard) / 14px (Browse-Shelf) > 13px Viewer-Count.
- Unbekannte Sprachen / `'other'` → kein Badge.

---

## Phase 6 — Flatpak-Packaging (in Arbeit, wartet auf WSL2 + Steam Deck)

Ziel: App läuft auf dem Steam Deck als Flatpak.

#### Neue Dateien (Phase 6):
- `flatpak/tv.twitch4steamdeck.App.yml` — Flatpak-Manifest (mpv + streamlink als Module)
- `flatpak/twitch4steamdeck.sh` — Launcher mit `zypak-wrapper` (Electron-Sandbox)
- `flatpak/tv.twitch4steamdeck.App.desktop` — Desktop-Eintrag
- `flatpak/build-flatpak.sh` — Build-Skript für WSL2 (prüft deps, füllt SHA256, baut)
- `resources/icons/icon.svg` — App-Icon (Platzhalter, konvertiert zu PNG beim Build)

#### Architektur-Entscheidungen:
- **Pre-Build in WSL2:** `npm install` + `@electron/rebuild` + `npm run build` laufen
  AUSSERHALB von flatpak-builder in WSL2. Das Manifest kopiert nur die Artefakte.
  → Vermeidet npm-im-Flatpak-Sandbox-Probleme.
- **Electron-Binary aus npm:** Das Electron-Binary kommt aus `node_modules/electron/dist/electron`
  (npm install für Linux), NICHT aus dem BaseApp. BaseApp liefert nur Chrome-Runtime-Libs + zypak.
- **zypak-wrapper:** Ersetzt Chrome-Setuid-Sandbox für Flatpak-Kompatibilität.
- **mpv:** Aus Sources gebaut, libplacebo deaktiviert (entfernt Vulkan-Abhängigkeitskette),
  ffmpeg/libass/libva kommen aus freedesktop SDK 24.08.
- **streamlink:** Via pip install ins Flatpak gebaut. Für sauberen Offline-Build:
  `flatpak-pip-generator` für Python-Dependencies verwenden (TODO beim echten Build).
- **better-sqlite3:** Muss für Linux x64 rebuilt werden (Steam Deck = AMD Zen2 x86_64,
  NICHT ARM64 — die alte ARM64-Notiz war falsch).
- **IPC-Socket:** `os.tmpdir()` → `/tmp` — beide Prozesse (Electron-Main + mpv-Child)
  teilen denselben Flatpak-Sandbox-Namespace. Kein Code-Fix nötig.
- **VAAPI:** `--hwdec=vaapi` bereits implementiert für non-win32 in `streamlink.ts:73`.
- **Flaggen-Emojis erst hier testbar** (Noto Color Emoji aus freedesktop Platform Runtime)

#### Noch ausstehend (User):
1. WSL2-Setup: `sudo apt install flatpak flatpak-builder librsvg2-bin`
2. `bash flatpak/build-flatpak.sh` (in WSL2, aus `/mnt/c/Projekte/twitch4steamdeck`)
3. Verifikation auf Steam Deck: Login, Live, VOD, Resume, Gamepad, Gaming Mode

---

## Technische Baseline

- Electron 33, electron-vite, TypeScript 5.5, React 18
- better-sqlite3 12.x (native, rebuilt für Electron via `@electron/rebuild`)
- streamlink 8.x unter `%LOCALAPPDATA%\Programs\Streamlink\bin\streamlink.exe`
- mpv v0.41.0 unter `C:\Program Files\MPV Player\mpv.exe`
- Dev-Host: **Windows**. Target: **Steam Deck (Linux / Flatpak)**

### Wichtiges Projekt-Memo
- Bei **allen Architekturänderungen** `plan.md` updaten.
- Nach **jeder Subaufgabe** Checkbox in `todo.md` setzen und Update hier.
- Dev-Host: **Windows**. Target: **Steam Deck (Linux / Flatpak)**.
- **Nicht** mit Speculative Abstractions aufblähen.
