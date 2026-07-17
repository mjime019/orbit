# CLAUDE.md — Orbit App (Session Handoff, July 2, 2026)

> Committed copy of the session handoff so it travels with the git repo. Since July 2, 2026 this repo lives at `~/Projects/orbit` (local, outside all sync agents — Google Drive sync corrupted the previous checkout). The canonical project spec and all docs (`software/`, `business/`, `analysis/`) live in the Google Drive Voyager folder (`~/Library/CloudStorage/GoogleDrive-mjime019@gmail.com/My Drive/0 Orbit/09 Voyager/CLAUDE.md`); if you have that folder, read it first and note its own "SESSION HANDOFF" section, which matches this one. If you only have this repo, the condensed context below is enough to work.

## What Orbit is (condensed)

Preschool concierge platform for dual-income millennial parents: a parent-facing control room + teacher-facing observation tools, connected by a shared **Child Memory Layer** that gets richer over time. Core premise: every output must feel personalized to *this* child ("Johnny had a wonderful day building X" beats "Your child had a great day"). Starting market: one school in Miami. Non-negotiables: teacher observation workflow ≤ 30 seconds; teacher approves AI content before parents see it; no diagnosis or clinical language; every AI output traceable to source observations.

**Stack:** Next.js 16 App Router (React 19, TS strict, Tailwind 4), Supabase (Postgres + RLS + Auth — auth not wired), deployed on Vercel (auto-deploy on push to `main` — **committing is safe, pushing is deploying**). **AI is Anthropic-only** (`claude-haiku-4-5`, ~$0.003–0.013 per observation) via the single wrapper `src/lib/ai.ts`: `callAI` returns `{ text, source }` and **throws `AIUnavailableError` on failure** — no silent fallback; the mock runs only with `AI_MODE=mock` set (local dev). The Gemini fallback was removed Jul 2026 (model retired; it transmitted child data before erroring).

**Layout:** server pages fetch via `src/lib/queries.ts`; client components mutate via `/api/*` routes; prompts in `src/lib/prompts.ts`; types in `src/lib/types.ts`; mock AI in `src/lib/ai-mock.ts`. Schema (23 tables + RLS) and seed data live in the parent folder at `software/architecture/supabase-schema.sql` / `seed-data.sql`; AI prompt docs at `software/architecture/ai-prompts.md` (drifted from code).

**Routes:** `/parent` (control room), `/parent/{highlights,activities,weekends,extras,transition,chat,onboarding,profile/[childId]}`, `/teacher` (dashboard), `/teacher/{observe,content,growth/[childId]}`, `/camp` (pilot tool, see below), `/` redirects to `/parent`.

## What the last session did, and why

Technical due-diligence audit — **no code changed** (audit-only mandate; committing pending code was left as an owner decision because pushing auto-deploys). Deliverables, in the Voyager folder:

- `analysis/technical/01-architecture.md` — data-flow map of the observation → AI → highlight → parent loop (every route/function), as-built vs. spec divergences, module maturity table, tech-debt hotspots. **Architecture & maturity: 2.5/5.**
- `analysis/technical/02-code-quality.md` — AI-integration audit (error handling, `callAI` abstraction, injection/output-trust, type safety, testing) + **ranked top-10 fixes with file paths and effort/impact**. **Code quality & AI integration: 2/5.**
- Business analyses exist at `analysis/commercial/` (scorecard, market, competition, unit-economics, red-team).

Key judgment call: ROADMAP.md's "Phase 1–3 COMPLETE ✅" was scored against actual wiring; several "complete" modules are styled renders of seed rows (see Current state).

## Critical findings, ranked (code citations in the analysis docs)

1. **Possible service-role key exposure — VERIFY FIRST (~15 min, no code).** The schema's RLS policies key on `auth.uid()`; with an anon key and no session they'd return zero rows — yet the app works, and ROADMAP admits "currently using service role key." Both Supabase clients read `NEXT_PUBLIC_SUPABASE_ANON_KEY`, which is compiled into the browser bundle. If Vercel has the service-role key in that var, every visitor is shipped full DB access. Check Vercel env + whether RLS was ever applied to the live project.
2. **Deploy drift.** This repo has 4 commits; the working tree has 14 modified files plus the **entire untracked camp module** (`src/app/camp/`, `src/app/api/camp/`). Production runs the old Gemini-or-mock `ai.ts`; the working tree's `ai.ts` is Anthropic `claude-haiku-4-5` primary → Gemini fallback → mock. Nothing the camp teacher uses is reproducible from git.
3. **Silent fabrication.** *(FIXED Jul 8, 2026 — see Changelog.)* `callAI` could never throw — mock was the unconditional last tier — so route-level error handling was dead code and quota exhaustion silently served invented child-specific anecdotes.
4. **Onboarding data loss ×2.** `src/app/api/parent/onboarding/complete/route.ts` builds `extraData` (sensitivities, routines, family) and never writes it; its `onboarding_responses` insert omits the NOT NULL `parent_id` and ignores the error — raw answers likely never persist.
5. **Cross-child leak.** `src/app/api/teacher/highlight/route.ts` fetches observations by id with no `child_id` check.
6. **Guardrails are prompt-text only.** No sanitization/output validation anywhere; concierge output reaches parents unreviewed; chat history and AI-extracted profile fields are interpolated into the *system* prompt (injection replay).
7. **Broken mock routing.** `ai-mock.ts` routes by case-sensitive substring of the system prompt; `WRITE A "WHY IT FITS" BLURB` (prompts.ts:199) matches nothing → activity personalization in mock mode returns a raw JSON blob as parent-facing copy.

## Current state

- **Wired end-to-end:** Observation Capture, Content Engine (highlights + digests, teacher-approved), Highlights feed, Concierge Chat (unreviewed output), Onboarding (lossy — finding 4), Camp pilot (off-schema table).
- **Read-only seed renders, no engine:** Weekends, Extracurriculars, Transition, Growth Journey. Activities half-wired (AI `why_it_fits` blurbs only; no matching engine).
- **Not built:** auth/login/landing, journey generation, weekend scoring, activity matching, tests (zero), migrations.
- **Small live bugs:** *(all FIXED Jul 8, 2026 — see Changelog)* `getUpcomingCalendarEvents` showed past events, `getTodayObservationCount` ignored its classroom param (both `src/lib/queries.ts`); chat prompt duplicated the just-sent parent message (`api/parent/chat/route.ts`).

## Remaining work, sequenced by dependency

0. Verify key/RLS situation (finding 1) — blocks all trust claims.
1. Commit & push the working tree (owner decision — push deploys): camp module, Anthropic `ai.ts`, 14 modified files.
2. Schema truth: add `camp_observations` to `../software/architecture/supabase-schema.sql`; adopt real migrations (`supabase/` dir).
3. Trust layer (top-10 list in 02-code-quality.md, items 1–5, auth-independent): expose mock/fallback tier in `callAI`'s return; shared zod-validated `parseAIResponse`; fix onboarding persistence; scope highlight observations to child; explicit promptType instead of prompt-sniffing mock routing.
4. Auth: Supabase Auth + roles; replace `DEMO_*` UUIDs (queries.ts, observe route, both approve routes, chat route); `@supabase/ssr` in `supabase-server.ts`; move `content-engine.tsx`'s browser-side DB reads behind the server.
5. Guardrails + injection hardening (top-10 items 6–7): history as real API message turns; banned-lexicon check on unreviewed surfaces.
6. Tests (nothing installed; pick vitest): prompts↔mock contract + parse/validate paths first.
7. Product engines: activity matching, weekend scoring, journey generation.

## Non-obvious gotchas

- **The camp pilot is paused (as of Jul 2026); target is a comprehensive demo on dummy/seed data.** The `/camp` tool remains live: teacher Carla voice-recorded daily notes about Felipe (3) and Rafael (4) — the founder's kids. Names/ages hardcoded in `api/camp/process/route.ts`'s system prompt. Data lands in `camp_observations` — a table that exists only in the live DB, absent from the schema file, read by nothing else. Camp routes now require the `x-camp-key` header (`CAMP_ACCESS_KEY` env; teacher enters it once on `/camp`). Note: the live table has anon INSERT/SELECT policies but **no UPDATE policy** — the save route falls back to insert; add the policy (see DEMO_FIXES_LOG.md).
- All identity is fixed seed UUIDs (Little Explorers Academy / Sunshine Room / Johnny / parent Miguel); the mock hardcodes seed classmate names into `src/lib/ai-mock.ts`.
- AI error handling in routes is now live code: `callAI` throws `AIUnavailableError` (status 429/502) and every route surfaces it. Don't naively add retries: the Anthropic SDK already retries 2× internally.
- `software/architecture/ai-prompts.md` drifted from `src/lib/prompts.ts` both ways; camp prompts are undocumented, inline in routes.
- `package.json` name is `orbit-temp`; the parent folder is Google Drive-synced (sync quirks possible); `software/specs/` is empty; the 8 artifact JSX mockups (~8,400 lines) are historical blueprints, drifted from shipped code.

## Demo runbook

- **Warm up Supabase before any demo.** The free tier auto-pauses after ~7 idle days; a paused project now renders a visible error page (queries throw) instead of confidently-empty widgets — still not what you want live. Load `/parent` 10 minutes before the demo; if it errors, resume the project in the Supabase dashboard (takes ~2 min). Upgrading to Pro removes auto-pause.
- Seed calendar events are Feb–Mar 2026 (past); the control room's "Coming Up" section correctly hides them now. Add future-dated rows to `school_calendar` if you want that section visible in the demo.
- The camp access code lives in `CAMP_ACCESS_KEY` (Vercel + `.env.local`); enter it once per device on `/camp`.
- Verifying AI failure UX locally: run with `ANTHROPIC_API_KEY="" npm run dev` — flows show errors, never mock content. `AI_MODE=mock` opts into the mock explicitly.

## Changelog

- **Jul 17, 2026 — product overhaul (branch `overhaul`).** Speech: shared
  `use-speech-capture` hook; stop() merges the interim buffer (fixes real
  dictation tail loss); teacher observe gains interim + auto-restart. One
  capture module for teachers AND parents at `/capture` (`?ctx=`): voice →
  words-first save into new `captures` table → multi-child AI extraction
  (dynamic roster) → sequential follow-ups → mandatory per-child review
  cards → fan-out into `observations` (`source` column: teacher|parent).
  `/camp` redirects there; camp process/followup routes deleted; Felipe &
  Rafael are real `children` (camp history migrated via
  `scripts/migrate-camp-observations.mjs`). Parent app rebuilt around a
  child-centric home (AI "What this means" cached in `child_summaries`,
  source-badged feed, module grid) inside an app shell (sticky header w/
  child switcher via `orbit_child` cookie, bottom tab bar, EmptyState/
  Skeleton/loading/error states); all module pages in-shell on the active
  child; `/parent/understand` merges profile + growth (parents never enter
  `/teacher` anymore); onboarding always escapable. Teacher dashboard adds
  end-of-day capture + Summer Camp roster. **Requires
  `scripts/schema-2026-07-overhaul.sql` run before this branch deploys.**

- **Jul 8, 2026 — demo-hardening session.** AI is Anthropic-only: Gemini fallback deleted (`@google/genai` removed), silent mock fallback removed (`AI_MODE=mock` opt-in only), `callAI` returns `{ text, source }` and throws `AIUnavailableError`; all 8 calling routes surface failures. Camp flow persists the transcript BEFORE any AI call (verified: save → process → followup network order) and the done screen reports save failures honestly with retry. Camp routes gated by `x-camp-key` shared secret. Speech-recognition auto-restart implemented (mic no longer dies on a 3–5s pause; rapid-end guard falls back to typing). `queries.ts` throws on DB errors (paused Supabase now errors instead of rendering empty); fixed upcoming-events future filter, classroom-scoped observation count, chat history duplication. Discovered live: `camp_observations` lacks an anon UPDATE policy (save route falls back to insert; policy SQL in DEMO_FIXES_LOG.md).
