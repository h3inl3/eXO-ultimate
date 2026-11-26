# eXO-ultimate — Implementation Plan

An app for managing ultimate frisbee teams on **Web, Android and iOS** with one common backend.

## 1. Goals

| # | Feature | Summary |
|---|---------|---------|
| 1 | Roster management | Add, edit, deactivate/delete players per team |
| 2 | Season management | Create seasons, season rosters, game schedules |
| 3 | Game management | Live stat-keeping, O/D lines, score, final result |
| 4 | Play management | Diagram plays live; create, edit, save, delete |

Cross-cutting requirements:

- **Multiple teams per user.** Each team has a division: `mixed`, `women` or `open`.
- **Per-team roles.** `owner | coach | stat_keeper | player`. One person can coach one team and play on another.
- **Player accounts.** Players link to their roster entry via invite and get read-only access to stats, results and the playbook.
- **Comprehensive stats** (every pass), with a stat-keeper UI that stays fast and simple.
- **Offline-first game tracking.** Fields often have no signal.

## 2. Architecture

TypeScript monorepo (pnpm workspaces + Turborepo):

```
apps/
  api/        Fastify + Drizzle ORM + PostgreSQL   ← the common backend
  web/        Next.js (React)
  mobile/     Expo / React Native (iOS + Android)
packages/
  shared/     Domain types, Zod schemas, scoring state machine, stat engine
infra/        docker-compose for local Postgres + Redis
```

- **Shared logic, not shared screens.** Web and mobile share types, validation, the scoring state machine, stat computation and the API client. Each platform builds its own UI.
- **API:** REST + OpenAPI under `/v1`. Changes are additive only. A minimum-client-version check forces updates of very old mobile builds.
- **Auth:** OIDC provider (Clerk / Auth0 / Supabase Auth). PKCE on mobile, httpOnly cookies on web. Sign in with Apple is required if any other social login is offered.
- **Storage:** PostgreSQL (managed), Redis (rate limits, queues), S3-compatible storage with pre-signed uploads.
- **Push:** Expo Push (APNs + FCM).
- **Observability:** Sentry on all clients and the API, plus structured logs.
- **Deploy:** web on Vercel, API as a container (Fly.io / Render / AWS ECS), mobile via EAS Build + Submit.

## 3. Key design decisions

### 3.1 Games are event streams
A game is stored as an append-only list of events, e.g. `pull → pass → pass → throwaway → d_block → goal`. Score, player stats, plus/minus and line efficiency are all **computed** from events.
- Undo means removing the last event.
- A correction made later recomputes everything.
- New stats can be computed back over past games.

### 3.2 Offline-first sync
- Each event gets a client-generated UUID, so writes are idempotent.
- Events are stored on the device: SQLite (`expo-sqlite`) on mobile, IndexedDB on web.
- `POST /v1/games/:id/events/batch` uploads when signal is available. Duplicates are ignored.
- **One scorekeeper device per game** holds a claim on it, avoiding merge conflicts. A coach can hand the claim over. Other users watch live via `GET /v1/games/:id/stream` (SSE).

### 3.3 Scoring state machine (in `packages/shared`)
```
pre_point → (pull | receive) → defense ⇄ offense → point_over → pre_point … → final
```
Which actions are legal in which state is encoded once and tested once, so web and mobile behave identically.

### 3.4 Division rules
- The division is set on the **team**. Seasons inherit it.
- Mixed teams set a gender-ratio rule per season (e.g. `ABBA`, or offense chooses). The line builder enforces and displays the required ratio each point.
- Women's and open teams skip ratio logic.

## 4. Data model

```
User ─ TeamMember(team, role) ─ Team(name, division)
Player(team, name, number, gender_match: MMP|FMP|null, positions[], active, user_id?)
PlayerInvite(player, code, expires_at, accepted_by?)
Season(team, name, starts_on, ends_on, rules JSON)
SeasonRoster(season, player, jersey_number)
Line(season, name, kind: O|D, player_ids[])
Game(season, opponent, starts_at, location, status, game_to, caps, final_us, final_them, scorekeeper_device?)
Point(game, number, start_on: O|D, player_ids[7], ratio?, scored_by: us|them|null)
GameEvent(id uuid, game, point, seq, type, actor?, receiver?, data JSON, client_ts, device_id)
Play(team, name, kind: O|D|pull|endzone, tags[], diagram JSON, version)
```

- **Players are soft-deleted** (`active=false`) because stats reference them. Hard delete is only allowed when the player has no events.
- **Event types:** `point_start` (carries the line and O/D), `pull`, `pass`, `goal`, `drop`, `throwaway`, `stall`, `d_block`, `callahan`, `pickup`, `opp_turnover`, `opp_goal`, `timeout`, `injury_sub`, `half`, `end`.
- **Season rules JSON:** `gameTo`, `halfAt`, `softCapMinutes`, `hardCapMinutes`, `timeoutsPerHalf`, `ratioRule`.

## 5. Stat-keeper UI

The current disc holder always has a **radial menu** open. **A completed pass is one tap on the receiver.**

```
 US 7 – 5 THEM   Pt 13 · OFFENSE · 4M/3F (B)        [UNDO]  [⋯]
                        Throwaway
               Stall        ▲        Goal
                    ◄   ( JO • )  ►
               Timeout      ▼
                          Drop
      ( SAM )      ( ALEX )      ( RIA )
             ( KAI )       ( MEI )      ( DEV )
   Last: Kai → Jo · Mei → Kai · Pull (Dev) IB
```

- **Offense**
  - Tap a teammate: records a pass and moves the radial menu to the receiver.
  - Holder's radial: **Goal** (holder caught it in the endzone; assist and hockey assist are inferred), **Drop** (holder dropped the last pass), **Throwaway**, **Stall**, **Timeout**.
- **Defense**
  - Tap a player for **D** or **Callahan**.
  - After a D or opponent turnover the disc is loose: tap whoever picks it up (`pickup`) and offense resumes. Receiving a pull works the same way.
  - Always-visible **Opp turnover** and **Opp scores** buttons.
- **Pull:** tap the puller, then choose In / Out / Brick.
- **Between points:** the line builder preselects the O/D preset and shows ratio (mixed teams), points played and rest time.
- **Ergonomics**
  - Player positions stay fixed all game.
  - Touch targets ≥ 60pt, landscape-first, haptic feedback on every event.
  - Undo is one tap. A running log shows the last three events.
  - Long-press a player for an injury sub.
- **Later**
  - Flick gestures instead of taps.
  - "Simple mode" for casual scorers.

**Field-test the prototype at a practice before Phase 3.**

## 6. Play diagrams

Plays are stored as a vector JSON document with **normalized field coordinates (0–1)**. The field is 70×40 yd with 20 yd endzones. A play is a sequence of frames, which gives step-through and animation:

```json
{ "field": { "orientation": "vertical", "view": "full" },
  "frames": [{
    "tokens": [{ "id": "o1", "side": "O", "label": "H1", "x": 0.42, "y": 0.61 }],
    "disc":   { "x": 0.42, "y": 0.60, "holder": "o1" },
    "paths":  [{ "token": "o3", "kind": "cut", "points": [[0.5,0.4],[0.7,0.2]] }],
    "note": "Dump swings, break side opens" }] }
```

- **Rendering:** SVG on web, `react-native-skia` on mobile.
- **Editing:** drag tokens, draw cuts and throws, pinch-zoom.
- **Live sideline sketching** works offline; the sketch can be saved to the playbook or discarded.
- **Concurrent edits:** an optimistic `version` field guards against conflicts.

## 7. API surface (v1)

| Area | Endpoints |
|------|-----------|
| Teams | `GET/POST /teams`, `GET/PATCH /teams/:id`, `GET/POST/PATCH/DELETE /teams/:id/members` |
| Roster | `GET/POST /teams/:id/players`, `PATCH/DELETE /players/:id`, `POST /players/:id/invite`, `POST /invites/:code/accept` |
| Seasons | `GET/POST /teams/:id/seasons`, `PATCH /seasons/:id`, `/seasons/:id/roster`, `/seasons/:id/lines` |
| Games | `GET/POST /seasons/:id/games`, `PATCH /games/:id`, `POST /games/:id/claim`, `POST /games/:id/events/batch`, `GET /games/:id/events`, `GET /games/:id/stream`, `GET /games/:id/summary` |
| Stats | `GET /seasons/:id/stats`, `GET /players/:id/stats` |
| Plays | `GET/POST /teams/:id/plays`, `GET/PATCH/DELETE /plays/:id` |

Every route is team-scoped and authorized by `TeamMember.role`:

| Role | Permissions |
|------|-------------|
| owner / coach | Everything |
| stat_keeper | Score games |
| player | Read-only |

## 8. Phases

| Phase | Scope | Est. (1–2 devs) |
|------:|-------|-----------------|
| 0 | Monorepo, CI, API + DB, OpenAPI client generation, empty apps deployed | 1–2 wks |
| 1 | Auth, multiple teams, roles, invites/claiming, **Roster**, scoring UI prototype | 3–4 wks |
| 2 | **Seasons**, schedule (CSV/ICS import), season roster, rules config | 2 wks |
| 3 | **Game** event model, offline storage + sync, lines, scoring screen, finalize | 4–5 wks |
| 4 | Stat engine, box scores, leaderboards, player-facing views | 3 wks |
| 5 | **Plays** editor (web + mobile), playbook, frames/playback | 3–4 wks |
| 6 | Push, live game view, polish, store submission | 2–3 wks |

**Total:** about 4.5–5.5 months to the first store release.

## 9. Testing

- **Unit tests:** `packages/shared` (state machine, stats).
- **Integration tests:** API against a real Postgres.
- **E2E:** Playwright on web, Maestro on mobile.

## 10. Risks

- **App store review:** account deletion is required, as are privacy labels.
- **Auth across platforms:** do it early.
- **Offline sync edge cases:** mitigated by the single-scorekeeper claim.
- **Scoring UI usability:** prototype and field-test early.
