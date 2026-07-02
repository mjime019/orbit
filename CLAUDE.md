# CLAUDE.md — Orbit App (Session Handoff, July 2, 2026)

> Committed copy of the session handoff so it travels with the git repo. The canonical project spec lives one level up in the Voyager folder (`../CLAUDE.md`, not a git repo — Google Drive-synced); if you have that folder, read it first and note its own "SESSION HANDOFF" section, which is identical to this one. If you only have this repo, the condensed context below is enough to work.

## What Orbit is (condensed)

Preschool concierge platform for dual-income millennial parents: a parent-facing control room + teacher-facing observation tools, connected by a shared **Child Memory Layer** that gets richer over time. Core premise: every output must feel personalized to *this* child ("Johnny had a wonderful day building X" beats "Your child had a great day"). Starting market: one school in Miami. Non-negotiables: teacher observation workflow ≤ 30 seconds; teacher approves AI content before parents see it; no diagnosis or clinical language; every AI output traceable to source observations.

**Stack:** Next.js 16 App Router (React 19, TS strict, Tailwind 4), Supabase (Postgres + RLS + Auth — auth not wired), AI via the single wrapper `src/lib/ai.ts`, deployed on Vercel (auto-deploy on push to `main` — **committing is safe, pushing is deploying**).

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
3. **Silent fabrication.** `callAI` (src/lib/ai.ts) can never throw — mock is the unconditional last tier — so all route-level 429/error handling is unreachable dead code, and quota exhaustion (Gemini free tier 15 RPM / 1M tokens/day; no budgeting code) silently serves invented child-specific anecdotes. Per ROADMAP, all AI flows were only ever verified against the mock.
4. **Onboarding data loss ×2.** `src/app/api/parent/onboarding/complete/route.ts` builds `extraData` (sensitivities, routines, family) and never writes it; its `onboarding_responses` insert omits the NOT NULL `parent_id` and ignores the error — raw answers likely never persist.
5. **Cross-child leak.** `src/app/api/teacher/highlight/route.ts` fetches observations by id with no `child_id` check.
6. **Guardrails are prompt-text only.** No sanitization/output validation anywhere; concierge output reaches parents unreviewed; chat history and AI-extracted profile fields are interpolated into the *system* prompt (injection replay).
7. **Broken mock routing.** `ai-mock.ts` routes by case-sensitive substring of the system prompt; `WRITE A "WHY IT FITS" BLURB` (prompts.ts:199) matches nothing → activity personalization in mock mode returns a raw JSON blob as parent-facing copy.

## Current state

- **Wired end-to-end:** Observation Capture, Content Engine (highlights + digests, teacher-approved), Highlights feed, Concierge Chat (unreviewed output), Onboarding (lossy — finding 4), Camp pilot (off-schema table).
- **Read-only seed renders, no engine:** Weekends, Extracurriculars, Transition, Growth Journey. Activities half-wired (AI `why_it_fits` blurbs only; no matching engine).
- **Not built:** auth/login/landing, journey generation, weekend scoring, activity matching, tests (zero), migrations.
- **Small live bugs:** `getUpcomingCalendarEvents` shows past events (desc sort, no future filter) and `getTodayObservationCount` ignores its classroom param (both `src/lib/queries.ts`); chat prompt duplicates the just-sent parent message (`api/parent/chat/route.ts`).

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

- **The camp pilot is real, running now.** Teacher Carla voice-records daily notes about Felipe (3) and Rafael (4) — the founder's kids — at `/camp`. Names/ages hardcoded in `api/camp/process/route.ts`'s system prompt. Data lands in `camp_observations` — a table that exists only in the live DB, absent from the schema file, read by nothing else.
- All identity is fixed seed UUIDs (Little Explorers Academy / Sunshine Room / Johnny / parent Miguel); the mock hardcodes seed classmate names into `src/lib/ai-mock.ts`.
- Don't trust the AI error handling in routes — dead code. Don't naively add retries: the Anthropic SDK already retries 2× internally.
- `software/architecture/ai-prompts.md` drifted from `src/lib/prompts.ts` both ways; camp prompts are undocumented, inline in routes.
- `package.json` name is `orbit-temp`; the parent folder is Google Drive-synced (sync quirks possible); `software/specs/` is empty; the 8 artifact JSX mockups (~8,400 lines) are historical blueprints, drifted from shipped code.
