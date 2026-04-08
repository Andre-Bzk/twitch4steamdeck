# Twitch4SteamDeck — Fortschritts-Snapshot

> Stand: **2026-04-08 (Session 3)**. Diese Datei dient als Übergabe zwischen Sessions.
> **Lies zuerst:** diese Datei + `todo.md` + `plan.md`.

**Aktueller Stand:** Phase 0–5 abgeschlossen & verifiziert. Als nächstes: Phase 6 (Flatpak-Packaging).

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

## Nächster Schritt: Phase 6 — Flatpak-Packaging

Ziel: App läuft auf dem Steam Deck als Flatpak.

Wichtige offene Punkte:
- mpv + streamlink müssen als Flatpak-Module gebündelt werden
- `--hwdec=vaapi` für Linux (Steam Deck) statt `auto` (Windows)
- IPC-Pfad: Unix Socket `/tmp/twitch4sd-mpv.sock` (bereits implementiert für non-win32)
- better-sqlite3 muss für Linux/ARM64 (Steam Deck) cross-compiliert werden
- Flatpak-Manifest: `flatpak/tv.twitch4steamdeck.App.yml`

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
