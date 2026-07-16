# DEMO_FIXES_LOG — July 8, 2026

Demo-hardening session against the technical-DD P0 list. Mandate: make the
deployed demo impossible to embarrass. All work committed locally on `main`
(**not pushed** — pushing auto-deploys; see "Before push" below).

## Commits

| Hash | Scope |
|---|---|
| `3dec083` | AI: Anthropic-only; failures surface as typed errors; mock opt-in via `AI_MODE=mock`; `@google/genai` removed; chat history dedup |
| `66c6834` | Camp: transcript persisted before AI; `x-camp-key` gate on all camp routes; mic auto-restart; honest save-failure UX with retry |
| `2c45ec6` | Queries: throw on DB errors; upcoming-events future filter; classroom-scoped count; transition lint fix |
| (this commit) | CLAUDE.md updates (Anthropic-only, demo runbook, changelog) + this log |

Pre-existing on the branch (from Jul 2): `d6dc7da` (session handoff doc),
`023eca0` (camp module + Anthropic-primary ai.ts as audited).

## What changed, by fix

1. **`src/lib/ai.ts`** — Gemini client/fallback deleted; `@google/genai`
   dropped from `package.json`/lockfile. `callAI` returns
   `{ text, source: 'anthropic' | 'mock' }`, throws `AIUnavailableError`
   (`.status` 429/502) on failure. Mock only when `AI_MODE=mock`. Stale
   "Haiku 3.5" comment fixed (model is `claude-haiku-4-5-20251001`). All
   **8** calling routes updated (P0 list said 6; grep found 8):
   teacher/{extract,highlight,digest}, parent/{chat,activities/personalize,
   onboarding/extract}, camp/{process,followup}.
2. **`src/app/camp/page.tsx`** — transcript is saved (awaited) BEFORE
   `/api/camp/process`; later saves update the same row (`savedIdRef`).
   AI failure returns the teacher to the review screen with their words
   intact and "your recording is saved — tap submit to retry". Done screen
   only claims "saved" when the save succeeded; otherwise shows the error
   and a Retry save button. Teacher observe flow checked — already safe
   (note stays in the textarea on extract failure; raw-save path exists).
3. **`src/app/api/camp/save/route.ts` + `src/lib/camp-auth.ts`** — GET and
   POST (and camp process/followup) return 401 without the `x-camp-key`
   header matching `CAMP_ACCESS_KEY`; fails closed when the env var is
   unset. Client prompts once for the code (stored in localStorage), record
   button disabled until entered, 401 clears the stored code and re-prompts.
4. **Mic auto-restart** — `onend` restarts recognition while recording is
   intended; 3 consecutive sub-1s ends = genuine failure → falls back to
   the typing input instead of looping. `not-allowed`/`service-not-available`
   also fall back to typing.
5. **`src/lib/queries.ts`** — every query throws on DB error (`must`/
   `mustList` helpers) so pages render an error instead of confidently
   empty. `getUpcomingCalendarEvents` now `gte(today)` ascending;
   `getTodayObservationCount` filters by `classroom_id` and uses a head
   count. Also: chat route no longer duplicates the just-sent parent
   message in the history prompt (adjacent one-line fix, in `3dec083`).
6. **Supabase auto-pause** — demo runbook added to `CLAUDE.md` (warm up 10
   min before demos; Pro removes auto-pause). With fix 5 a paused project
   errors visibly instead of rendering empty.
7. **CLAUDE.md** (in-repo) — stack line now Anthropic-only with cost
   (~$0.003–0.013/observation), stale findings marked fixed, camp-pilot
   gotcha updated (paused; key-gated), demo runbook + dated changelog
   added. The Drive-folder spec's AI section was also rewritten
   (Gemini wrapper/free-tier limits replaced; principle #6 reframed to
   capture-workflow-as-moat).

## Verification gate results

| Gate | Result |
|---|---|
| (a) zero `gemini\|GoogleGenAI\|GEMINI_API_KEY` hits in src/ + package.json | **PASS** (grep exit 1) |
| (b) `/api/camp/save` without auth | **PASS locally**: GET/POST → 401 (no key, wrong key); data only with key. **Deployed check pending push** |
| (c) unset `ANTHROPIC_API_KEY` → visible error, zero mock | **PASS**: camp process + teacher extract → 502 `"AI is not configured (ANTHROPIC_API_KEY missing)…"`; `AI_MODE=mock` opt-in verified separately |
| (d) transcript survives AI/network failure | **PASS (persistence half)**: full flow driven in browser — network order `save → process → followup`; save-failure path exercised for real (see below) and Retry save recovered. **Mic 5s-pause half needs a physical mic — manual test on your phone** |
| (e) "Coming Up" shows only future events | **PASS**: seed events (Feb 27/Mar 4) are past → section correctly hidden. Add future-dated `school_calendar` rows for demo visibility |
| (f) `npm run build` + eslint | **PASS**: build clean; eslint 0 errors (4 pre-existing unused-var warnings) |

Live end-to-end run (real Anthropic, live DB): text-input capture →
extraction attributed Felipe/Rafael correctly with verbatim quote →
specific AI follow-up question → final save.

## Found during verification (new)

- **`camp_observations` has no anon UPDATE policy** — the final save
  (update-by-id) matched zero rows under RLS and failed. The done screen
  surfaced it honestly and Retry save recovered via the new insert
  fallback. Real fix, run in Supabase SQL editor:
  ```sql
  create policy "anon_update_camp_observations" on camp_observations
    for update to anon using (true) with check (true);
  ```
  Until then the flow works but can leave one transcript-only row per
  session alongside the full row.
- **2 TEST rows** in `camp_observations` (transcripts start with
  "TEST verification row, safe to delete") — delete in the dashboard.

## Env checklist (Vercel dashboard)

**Never record a secret's value in this file — it is committed to a public
repo (github.com/mjime019/orbit). Values live in Vercel and `.env.local`
(gitignored) only.** An earlier revision of this doc violated that; see
"Secret leak" below.

1. `ANTHROPIC_API_KEY` — **verified present** in Production (Jul 16, 110
   chars, added 112d ago). The camp pilot ran on real Anthropic, not
   Gemini-or-mock.
2. `CAMP_ACCESS_KEY` — **verified present but EMPTY** in Production (Jul
   16). An empty value makes `requireCampKey` fail closed, so every camp
   request 401s, including ones sending the right code. Set a real value
   in the Vercel dashboard, then redeploy for it to take effect.
3. `GEMINI_API_KEY` — **verified removed** from Vercel (Jul 16); already
   gone from `.env.local`.
4. `NEXT_PUBLIC_SUPABASE_ANON_KEY` — verified Jul 8 (browser audit) and
   re-confirmed Jul 16: 46 chars, matching `sb_publishable_…`; a
   service-role JWT would be 200+. NOT the service-role secret.
   ROADMAP.md:141's "using service role key" is disproven.

## Secret leak (Jul 16, 2026) — resolved by rotation

An earlier revision of this file recorded the proposed `CAMP_ACCESS_KEY`
value in plaintext. It was committed and pushed to the **public** repo, so
that value is permanently burned and must never be used. Blast radius was
nil: the Vercel variable was empty the whole time, so the leaked string was
never a working credential in production — it only ever matched local dev.

Remediation: value scrubbed from this file; a fresh key was generated and
set directly in Vercel + `.env.local`, never written to the repo. The old
string remains in git history (public, unremovable in practice) but is
worthless. Retrieve the current value from Vercel or `.env.local`.

## Before push (deploys to production)

- Add `CAMP_ACCESS_KEY` to Vercel FIRST (else the live camp tool 401s with
  no way in), confirm `ANTHROPIC_API_KEY` present, remove `GEMINI_API_KEY`.
- After deploy: `curl -i https://<app>/api/camp/save` → expect 401 (gate b,
  deployed); load `/parent` and `/camp`; run one capture end-to-end.
- Optional preview-deploy check for gate (c) by unsetting the key in a
  preview environment.

## Deferred / known-open (pre-existing, out of this session's scope)

- Anon RLS policies on core tables (`children`, `observations`,
  `highlights` readable; `conversations`/`messages` ALL) — flagged Jul 8
  audit; fine for dummy-data demo, must fix before any real child data.
  Sequenced fix: service-role key server-side → tighten anon policies →
  move content-engine browser reads server-side.
- No auth; `DEMO_*` seed UUIDs everywhere; `supabase-server.ts` uses the
  anon key (its "service role" comment is wrong).
- Onboarding persistence loss (`extraData` never written; parent_id
  missing on `onboarding_responses` insert).
- Highlight route: observations fetched by id without a `child_id` scope.
- Zero tests; no migrations; `camp_observations` absent from schema file.
- 4 eslint unused-var warnings (pre-existing).
