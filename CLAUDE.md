# Twitch4SteamDeck — CLAUDE.md

Twitch client for the Steam Deck. Electron + React, gamepad-navigable, Big-Screen UI (on Linux/Steam Deck: window maximized on primary display; on Windows dev: 1280x800). Supports live streams and VODs with resume and chapter selection. Deployed as a Flatpak on the Steam Deck.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Electron 33, electron-vite, React 18, TypeScript 5.5 |
| Playback | hls.js 1.6 (HTML5 `<video>` in renderer), Streamlink 6.11.0 in Flatpak build / 8.2.1 on Windows dev (only for `--stream-url`) |
| Gamepad (Linux) | evdev `/dev/input/event*` with BTN_* codes (Xbox, PlayStation, Nintendo; USB + Bluetooth) |
| DB | better-sqlite3 (VOD history + resume positions) |
| Packaging | Flatpak (freedesktop SDK 24.08, Electron2 BaseApp) |
| Build host | Windows, Flatpak build runs in WSL2 |
| Target | Steam Deck (Linux x86_64, Gaming Mode) |

---

## Architecture

```
Electron Main Process
├── AuthService          — Twitch Device Code Flow, token management (safeStorage)
├── HelixClient          — Twitch Helix REST API + GQL (chapters)
├── PlaybackService      — Live/VOD orchestration
│   └── streamlink.ts    — getStreamUrl() + getAvailableQualities() via streamlink
├── historyRepo          — SQLite VOD history (resume, completed)
└── gamepadReader        — Linux evdev /dev/input/event* (via js* discovery, BTN_* codes)

Preload (contextBridge)
└── window.t4sd          — Typed IPC bridge (auth, twitch, history, playback, gamepad)

Renderer (React)
├── App.tsx              — Auth gate: LoginScreen | AppShell (wrapped in ErrorBoundary)
├── AppShell.tsx         — Tab routing, sidebar/main focus, global playback overlay
├── screens/             — FollowingScreen, BrowseScreen, CategoryScreen,
│                          ChannelScreen (main screen), StreamListScreen, Settings, Account
├── components/
│   ├── VideoPlayer.tsx  — hls.js <video> wrapper (forwardRef, imperative handle)
│   ├── PlaybackOverlay.tsx — DOM overlay over the video (z-index: 300)
│   ├── ChapterPanel.tsx — Chapter selection panel as a standalone component
│   ├── QualityPanel.tsx — Quality selection panel as a standalone component
│   ├── ErrorBoundary.tsx — React Error Boundary (errors logged via electron-log)
│   └── GamepadPrompt.tsx — Typed gamepad button icons (face, shoulder, D-pad)
├── hooks/
│   ├── usePlaybackSession.ts — Shared playback state hook for AppShell + ChannelScreen
│   └── useChannelKeyHandler.ts — Mode-based key handler for ChannelScreen
├── lib/
│   ├── playbackKeys.ts  — Shared key dispatch for playback (AppShell + ChannelScreen)
│   └── hlsNoCacheLoader.ts — Fetch API-based hls.js loader (cache: 'no-store')
├── input/gamepad.ts     — Browser Gamepad API (Windows, dev mode)
└── context/SettingsContext.tsx — localStorage settings (streamBadgeMode, sidebarWidth, …)
```

### Data Flow

- **Auth:** LoginScreen → IPC → AuthService → Device Code Flow → token (safeStorage)
- **Browsing:** Screen → IPC → HelixClient → Twitch Helix API → Screen
- **Live playback (via ChannelScreen):** ChannelScreen → IPC `playback:start-live` → PlaybackService → `streamlink --stream-url twitch.tv/<login>` → HLS URL → IPC event `playback:hls-url` → renderer → `VideoPlayer` (hls.js)
- **Live playback (direct start):** BrowseScreen/StreamListScreen/CategoryScreen → A button → `window.t4sd.playback.startLive()` → PlaybackService → HLS URL → IPC event `playback:hls-url` → AppShell global overlay → `VideoPlayer` (hls.js) — **no ChannelScreen routing**
- **VOD playback:** ChannelScreen → IPC `playback:start-vod` → PlaybackService → `streamlink --stream-url twitch.tv/videos/<id>` → HLS URL → IPC event `playback:hls-url` → renderer → `VideoPlayer` (hls.js, seekTo startPosition)
- **Overlay:** `PlaybackOverlay` (z-index: 300) sits as a normal DOM element over `VideoPlayer` (z-index: 100) — no window layering needed
- **Seek/pause/stop:** directly via `videoRef.current` (no IPC round-trip)
- **Quality switch:** `videoRef.current.stop()` → `startLive/startVod(quality)` → new `playback:hls-url` event — streamlink restart required since single-bitrate HLS (no hls.js level switch possible)
- **Quality list:** IPC `playback:get-qualities` → `streamlink --json <url>` → `Object.keys(streams)` sorted by fixed order array
- **Position tracking:** `VideoPlayer` reports every 5s via IPC `playback:report-position` → main → SQLite
- **Gamepad:** evdev `/dev/input/event*` via js* discovery (Linux/Gaming Mode) **or** `navigator.getGamepads()` (Windows/dev) → synthetic `KeyboardEvent`s → all screen handlers respond to keys

---

## Development

### Prerequisites
- Node.js, npm
- `.env` with `MAIN_VITE_TWITCH_CLIENT_ID=<your-client-id>` (Twitch Application, Public, Device Code Flow)
- Windows: Streamlink at `%LOCALAPPDATA%\Programs\Streamlink\bin\streamlink.exe`

### Build Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Electron dev server with hot reload
npm run build        # Production build (out/)
npm run typecheck    # Check TypeScript (npx tsc --noEmit)
npm run package      # Build Linux AppImage (dist/)
```

### Flatpak Build (WSL2)
Must run from the WSL2 filesystem (NOT `/mnt/`):
```bash
bash flatpak/build-flatpak.sh
```
The script: checks deps → npm build → generate Python deps → hash Streamlink tarballs → `flatpak-builder` → SCP to Steam Deck.

---

## Codebase Structure

```
src/shared/
  types.ts                    — Shared types between main + renderer (AuthStatus, PlaybackEvent, HlsUrlPayload, VodInfo, VodChapter, …)

src/main/
  index.ts                    — Electron entry point, service wiring, window (Linux: maximized on primary display; Windows: 1280x800), CORS handler for Twitch CDN
  env.d.ts                    — Type for MAIN_VITE_TWITCH_CLIENT_ID
  auth/
    authService.ts            — Auth lifecycle, token refresh, event emitter
    deviceCodeFlow.ts         — OAuth Device Code + polling (https://id.twitch.tv/oauth2/)
    tokenStore.ts             — safeStorage encryption, plaintext fallback
  constants/
    input.ts                  — TRIGGER_THRESHOLD, DEDUP_WINDOW_MS, HOTPLUG_SCAN_INTERVAL_MS
  input/
    gamepadReader.ts          — evdev /dev/input/event* reader (via js* discovery), hotplug (3s scan), deduplication (40ms); BTN_* codes for driver-independent controller mapping
  ipc/
    channels.ts               — IPC channel names as a typed constants object (IPC.*); single source of truth
    handlers.ts               — All ipcMain.handle() registrations + event forwarding
  playback/
    playbackService.ts        — Orchestrator: streamlink --stream-url → HLS URL → playback:hls-url event; startVod(quality?); getAvailableQualities()
    streamlink.ts             — getStreamUrl() + getAvailableQualities() via streamlink (--stream-url for URL, --json for quality list)
    types.ts                  — Quality type; re-exports PlaybackEvent from src/shared/types
  prefs/
    hlsCachePref.ts           — In-memory flag for HLS disk cache activation (set via app:set-hls-cache-enabled IPC)
  store/
    db.ts                     — SQLite init, WAL mode, migration (vod_history table)
    historyRepo.ts            — upsertVod, updatePosition, markCompleted, getProgressMap
  twitch/
    helixClient.ts            — Helix API (followed, streams, videos, games) + GQL (chapters)
    types.ts                  — Helix-specific types

src/preload/
  index.ts                    — contextBridge: window.t4sd (auth, twitch, history, playback, gamepad)

src/renderer/
  index.html                  — CSP: default-src 'self'; media-src 'self' blob: (blob: required for hls.js MediaSource)

src/renderer/src/
  App.tsx                     — Auth gate, gamepad init, ErrorBoundary wrapper
  main.tsx                    — React DOM bootstrap, SettingsProvider
  screens/
    AppShell.tsx              — Tab routing, sidebar/main focus split, global playback overlay (direct stream start without ChannelScreen), quality selection for live
    LoginScreen.tsx           — Device code login, QR code, countdown
    FollowingScreen.tsx       — Followed channels (grid), live/offline sort
    BrowseScreen.tsx          — Top streams shelf (A=direct play, X=channel page) + category grid (infinite scroll)
    CategoryScreen.tsx        — Streams for a category (A=direct play, X=channel page)
    ChannelScreen.tsx         — Channel detail, VOD shelf, VideoPlayer + PlaybackOverlay, chapter panel, quality selection; key handling via useChannelKeyHandler
    StreamListScreen.tsx      — Language-filtered stream list DE/EN (A=direct play, X=channel page)
    SettingsScreen.tsx        — streamBadgeMode, sidebarWidth, badgeGap, hlsCacheEnabled, fileLoggingEnabled
    AccountScreen.tsx         — User info, logout (with confirmation dialog)
  components/
    VideoPlayer.tsx           — hls.js <video> wrapper, forwardRef (seek, seekTo, pause, play, stop, getCurrentTime); attachMedia before loadSource; play() in MANIFEST_PARSED
    PlaybackOverlay.tsx       — DOM overlay (seek bar, channel info, gamepad hints, auto-hide); playState: 'playing'|'paused'
    ChapterPanel.tsx          — Chapter selection panel (during playback or VOD start); duringPlayback prop controls label
    QualityPanel.tsx          — Quality selection panel with button + dropdown list
    ErrorBoundary.tsx         — React Error Boundary; logs via electron-log, shows reload button
    GamepadPrompt.tsx         — Typed gamepad button renderer (<GamepadPrompt prompt="a"/>, <GamepadHintItem>)
    FocusableCard.tsx         — Reusable channel card (thumbnail, badge, progress)
    Sidebar.tsx               — Navigation sidebar (6 tabs)
    LanguageBadge.tsx         — Language/flag badge
    Icons.tsx                 — SVG icons
  constants/
    ui.ts                     — CARD_W, CARD_GAP, STREAM_W, STREAM_GAP (card/grid sizes)
    playback.ts               — OVERLAY_HIDE_DELAY_MS, DOUBLE_TAP_MS, POSITION_REPORT_INTERVAL_MS
    input.ts                  — AXIS_THRESHOLD, REPEAT_INITIAL_MS, REPEAT_INTERVAL_MS
  context/
    SettingsContext.tsx        — localStorage settings (streamBadgeMode, sidebarWidth, badgeGap, hlsCacheEnabled, fileLoggingEnabled), CSS custom properties sync
  hooks/
    usePlaybackSession.ts     — Shared hook: hlsPayload, playState, videoRef, quality panel state, startLive/startVod/stop; used by AppShell + ChannelScreen
    useChannelKeyHandler.ts   — Mode-based key handler for ChannelScreen; 5 modes: chapter/playback-quality/playback/hero/shelf
  input/
    gamepad.ts                — Browser Gamepad API, rAF poll, axis debounce
  lib/
    formatting.ts             — Shared format utilities (time, numbers, duration)
    languageBadge.ts          — ISO code → flag/abbreviation mapping (~40 languages)
    playbackKeys.ts           — Shared key dispatch for playback mode + quality panel; used by AppShell + ChannelScreen
    hlsNoCacheLoader.ts       — Fetch API-based hls.js loader (cache: 'no-store'); prevents HLS disk cache more reliably than XHR headers
  styles/
    global.css                — Dark theme (#0e0e10, #9147ff accent), 1280x800-optimized
  types/
    t4sd.d.ts                 — window.t4sd type declaration

scripts/
  test-playback-pipeline.mjs  — Standalone test: streamlink → HLS URL → manifest → segment (node scripts/test-playback-pipeline.mjs twitch.tv/<channel>)

flatpak/
  tv.twitch4steamdeck.App.yml — Flatpak manifest (Streamlink, all native deps)
  build-flatpak.sh            — 6-step build pipeline (WSL2)
  twitch4steamdeck.sh         — Launcher with zypak wrapper
  tv.twitch4steamdeck.App.desktop
```

---

## Key Patterns & Architecture Decisions

### IPC Bridge Pattern
All renderer→main calls go through `window.t4sd.*` (defined in `src/preload/index.ts`). New features require:
1. Channel constant in `src/main/ipc/channels.ts` (in the `IPC` object)
2. Handler in `src/main/ipc/handlers.ts` (`ipcMain.handle(IPC.channelAction, ...)`)
3. Bridge method in `src/preload/index.ts`
4. Type declaration in `src/renderer/src/types/t4sd.d.ts`

IPC namespaces: `app:` (quit, cache size, clear cache, HLS cache toggle, file logging toggle), `auth:`, `twitch:`, `history:`, `playback:`, `gamepad:` (main→renderer events).

### Two Playback Contexts

Both contexts use `usePlaybackSession` (`src/renderer/src/hooks/usePlaybackSession.ts`) — the hook encapsulates `hlsPayload`, `playState`, `videoRef`, quality panel state, and `startLive`/`startVod`/`stop`. The `active` parameter controls whether the hook subscribes to IPC events (hls-url, playback-event).

**1. ChannelScreen playback** (live + VOD, via X button or "You follow"):
- User navigates to ChannelScreen → presses "▶ Watch live" or selects a VOD
- ChannelScreen instantiates `usePlaybackSession({ active: true })` — owns its own session and PlaybackOverlay
- VOD features: resume, chapter panel, position tracking

**2. Global AppShell overlay** (direct start, A button in BrowseScreen/StreamListScreen/CategoryScreen):
- User presses A on a stream card → `onStartLive(ch)` → AppShell calls `startLive()` directly
- AppShell instantiates `usePlaybackSession({ active: !isChannelScreenActive })` — `active` enables IPC subscription
- During playback: `hasFocus={false}` for all browse screens → no key conflicts
- AppShell key handler uses `dispatchPlaybackKey()` + `dispatchQualityPanelKey()` from `playbackKeys.ts`
- Live streams only (no VOD, no resume, no position tracking)

### Playback Architecture (hls.js in renderer)
Video runs as an HTML5 `<video>` element inside the Electron window — **no external mpv process**.

**VideoPlayer initialization (critical order):**
1. `hls.attachMedia(video)` — build the media context first
2. In the `MEDIA_ATTACHED` event: `hls.loadSource(hlsUrl)` — load the source only then
3. In the `MANIFEST_PARSED` event: `video.play()` — MediaSource is ready now
- **Order matters:** `loadSource` before `attachMedia` → MANIFEST_PARSED fires before MSE is ready → `play()` throws `NotSupportedError: The element has no supported sources`
- **CSP:** `media-src 'self' blob:` in `src/renderer/index.html` — hls.js needs `blob:` for MediaSource

**Imperative handle** — ChannelScreen / AppShell hold `videoRef = useRef<VideoPlayerHandle>()`:
- `videoRef.current.seek(delta)` — relative seek (seconds)
- `videoRef.current.seekTo(abs)` — absolute seek
- `videoRef.current.pause()` / `.play()` / `.togglePause()`
- `videoRef.current.stop()` — destroys the hls.js instance, clears `<video>`
- `videoRef.current.getCurrentTime()` — current playback position (synchronous)

**Why this approach:** The earlier approach with an external mpv fullscreen window was always placed over the Electron window by the OS window manager (Gamescope on Steam Deck). CSS `z-index` only works within a single document, not at the OS window level. The fix: keep video and overlay in the same rendering context.

### Quality Selection During Playback
- **Quality switch = streamlink restart**: streamlink delivers single-bitrate HLS → hls.js level switch not usable. Switch: `videoRef.stop()` → `startLive/startVod(quality)` → new `hls-url` event.
- **VOD with resume**: `getCurrentTime()` before stop → passed as `startSeconds` to the new `startVod()`.
- **Quality list**: fetched asynchronously after stream start via `playback:get-qualities` IPC → `streamlink --json <url>` → `Object.keys(json.streams)`, sorted: `['best', '1080p60', '720p60', '480p', '360p', '160p', 'audio_only', 'worst']`
- **Session-only**: not persisted to settings/localStorage.
- **Panel state in parent**: `qualityPanelOpen`, `qualityFocusedIndex` in ChannelScreen/AppShell — the `QualityPanel` component receives props + callbacks.
- **Key handler isolation**: In ChannelScreen the `playback-quality` mode of `useChannelKeyHandler` takes full control; in AppShell `dispatchQualityPanelKey()` from `playbackKeys.ts` handles it — seek/pause conflicts are impossible.
- **X button** opens the quality panel (gamepad button X → `x` keyboard event).

### Chapter Panel During Playback
When the user opens the chapter panel during playback (Y button), the video keeps **playing** (not paused). `PlaybackOverlay` is hidden via conditional render (`!chapterPanelVod`); instead `ChapterPanel` appears with `duringPlayback={true}`. After selecting a chapter: `seekTo(chapter.positionSeconds)` — no `play()` needed since the video is already running. After closing without a selection: panel gone, video continues unchanged. With an empty chapter list: X button seeks to `0` (start of video).

### Key Handler Architecture (ChannelScreen)
`useChannelKeyHandler` (`src/renderer/src/hooks/useChannelKeyHandler.ts`) encapsulates all keyboard input for ChannelScreen. The hook registers **one** stable `keydown` listener and dispatches based on a `mode` parameter:

| Mode | Active when |
|---|---|
| `chapter` | Chapter panel is open |
| `playback-quality` | Quality panel is open during playback |
| `playback` | Video is playing, no panel open |
| `hero` | Channel hero is focused (no playback) |
| `shelf` | VOD shelf is focused |

All binding objects are held in a ref — the listener never needs to be re-registered. No stale-closure bugs, no long dependency arrays.

**Shared playback dispatch** (`src/renderer/src/lib/playbackKeys.ts`): `dispatchPlaybackKey()` and `dispatchQualityPanelKey()` are pure functions used both by `useChannelKeyHandler` (ChannelScreen) and directly by AppShell — a single source of truth for playback key bindings in both contexts.

### Gamepad Dual Path
- **Linux/Gaming Mode:** `src/main/input/gamepadReader.ts` uses Linux evdev (`/dev/input/event*`). Discovery scans `/dev/input/js*`; for each js* device the corresponding `event*` device is found via `/sys/class/input/jsN` and opened. This reads standardized `BTN_*` codes (BTN_NORTH=X, BTN_SOUTH=A, etc.) — works driver- and controller-independently for Xbox, PlayStation, Nintendo, and any USB/Bluetooth gamepad.
- **Windows/dev:** `src/renderer/src/input/gamepad.ts` uses `navigator.getGamepads()` via rAF loop
- Both paths produce synthetic `KeyboardEvent('keydown')` events. All UI components respond to key events only — no gamepad code in screens.
- Button mapping: A=Enter, B=Escape, X=x, Y=y, LB=l1, RB=r1, LT=l2, RT=r2, D-Pad=Arrows
- Fallback: if `/sys` lookup fails, `JoystickFallbackReader` opens the js* device directly (legacy joystick API with fixed button number mapping)

### A Button Behavior per Screen
| Screen | A button | X button |
|---|---|---|
| FollowingScreen | Open channel page | — |
| BrowseScreen (shelf) | Start stream directly (AppShell overlay) | Open channel page |
| StreamListScreen | Start stream directly (AppShell overlay) | Open channel page |
| CategoryScreen | Start stream directly (AppShell overlay) | Open channel page |
| ChannelScreen | Start live stream / confirm | — |

### VOD vs. Live Playback
- **Live:** `streamlink --stream-url twitch.tv/<login> <quality>` → HLS URL → hls.js plays live playlist natively
- **VOD:** `streamlink --stream-url twitch.tv/videos/<id> <quality>` → HLS URL → hls.js seeks to `startPosition` via `video.currentTime`
- **Quality default:** `'best'` — not persisted, session state only
- **Resume:** `history.getPosition(vodId)` in the main process → as `startPosition` in the `playback:hls-url` event → `VideoPlayer` seeks after MANIFEST_PARSED

### Position Tracking
`VideoPlayer` reports every 5s via `window.t4sd.playback.reportPosition(vodId, currentTime, durationSeconds)` → main → `historyRepo.updatePosition()` + `markCompleted()` (at >95% progress). VODs only (not live).

### Twitch API
- Helix REST API for all standard data: `https://api.twitch.tv/helix`
- Twitch GraphQL for chapter data (`getVodChapters`): `https://gql.twitch.tv/gql` with public client ID `kimne78kx3ncx6brgo4mv6wki5h1ko` (no own token needed)
- Auth scope: `user:read:follows` only
- `getTopGames()` makes 40 parallel `/streams?game_id=<id>&first=100` calls to estimate viewer counts

### Settings Persistence
- UI settings (badge mode, sidebar width, badge gap, HLS cache toggle, file logging toggle) → `localStorage` under key `t4sd:settings` (no IPC, no flicker on startup); changes are mirrored to the main process via IPC (`app:set-hls-cache-enabled`, `app:set-file-logging-enabled`)
- VOD history + resume → SQLite `history.db` in `userData/`
- Twitch tokens → Electron `safeStorage` (OS keystore), file: `userData/twitch-tokens.bin`

---

## Known Limitations

| Problem | Status | Details |
|---|---|---|
| hls.js performance on Steam Deck | Untested | Chromium's VA-API hardware decode should be sufficient. If dropped frames at 1080p60 → use the quality button in the overlay (select 720p60). |
| Twitch live stream URL expiry | Non-critical | `streamlink --stream-url` token in URL can expire. hls.js handles playlist refresh automatically; on connection loss the stream must be restarted. |
| Ad bypass | Not implemented | `--twitch-disable-ads` is deprecated in Streamlink. Post-MVP. |
| Flag emojis on Windows | Boxes only | Unicode Regional Indicators require Noto Color Emoji (Linux). Ignore in dev mode. |
| Browser Gamepad API in Gaming Mode | Not usable | Steam Input + Flatpak sandbox blocks udev events for Chromium. That is why evdev is read directly in the main process. |
| Bluetooth controller deduplication | Active | Multiple `/dev/input/js*` devices (e.g. raw device + Steam virtual device) → 40ms deduplication window in `gamepadReader.ts` |
| Direct start: no VOD support | By design | AppShell overlay is live streams only. VODs are only available via the channel page (ChannelScreen) with resume + chapters. |

---

## Deployment on Steam Deck

```bash
# Install on Steam Deck (once)
flatpak install --user twitch4steamdeck.flatpak

# Launch
flatpak run tv.twitch4steamdeck.App

# Update (reinstall)
flatpak uninstall tv.twitch4steamdeck.App
flatpak install --user twitch4steamdeck.flatpak
```

Flatpak permissions (from manifest): `--share=network`, `--socket=x11`, `--socket=pulseaudio`, `--device=all` (GPU + `/dev/input/*`), `--share=ipc`.

---

## Typical Debugging Workflows

### No playback / video does not start
1. Check DevTools console (Ctrl+Shift+I in dev mode) — `[VideoPlayer]` logs show every step
2. Run `node scripts/test-playback-pipeline.mjs twitch.tv/<channel>` — tests streamlink + manifest + segment
3. Run `streamlink --stream-url <url> best` manually: does it return a valid `https://` URL?
4. CSP error? → check `src/renderer/index.html`: `media-src 'self' blob:` must be present
5. CORS error? → check `session.defaultSession.webRequest` in `index.ts`

### VideoPlayer diagnostics (DevTools console)
These logs appear on startup (all with `[VideoPlayer]` prefix):
- `Hls.isSupported: true` — hls.js can use MSE
- `attachMedia called` — MediaSource is being built
- `MEDIA_ATTACHED — loading source` — MediaSource ready, manifest is being loaded
- `MANIFEST_PARSED — readyState: X networkState: Y` — manifest loaded, play() is called
- `play() succeeded` — video is running

### VOD starts at wrong position
1. Is `startPosition` correct in the `playback:hls-url` event? Check `PlaybackService.startVod()`
2. hls.js seeks in the `MANIFEST_PARSED` handler: `video.currentTime = startPosition`

### Gamepad inputs not received (Steam Deck)
1. `gamepadReader.ts` scans `/dev/input/js*` — check if js device is present (`ls /dev/input/js*`)
2. For each js device, an evdev device (`event*`) is looked up via `/sys/class/input/jsN` — log `[gamepad] opened (evdev): /dev/input/js0 → /dev/input/event4` shows whether this worked
3. Deduplication window: 40ms — increase `DUPLICATE_EVENT_WINDOW_MS` for double inputs
4. Axis mapping: D-pad is ABS_HAT0X/Y (code 16/17), stick is ABS_X/Y (code 0/1, threshold 16384)

### IPC channel missing / unknown
Check: `channels.ts` (channel constant), `handlers.ts` (main), `preload/index.ts` (bridge), `t4sd.d.ts` (renderer types) — all four must be consistent.

### TypeScript errors
```bash
npm run typecheck
```
Two independent tsconfigs: `tsconfig.node.json` (main + preload) and `tsconfig.web.json` (renderer).
