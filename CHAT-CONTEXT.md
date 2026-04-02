# FamSync — Chat Context for Continuation

Use this file to onboard a new Claude session on the FamSync project.

---

## What Is This

FamSync is a co-parenting / family coordination PWA. The personal instance is called **CreelSync**. Built by Keith Creelman (FITFO Systems). Started as a personal MVP for Keith and his ex-wife, with architecture designed for future SaaS.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 — PWA
- **Backend/DB**: Supabase (Postgres + Auth + Storage + Realtime + RLS)
- **AI**: Anthropic Claude API (NLP event parsing, screenshot extraction via Vision)
- **Hosting**: Vercel (not yet deployed — running locally)
- **Auth**: Supabase Auth — currently magic link only, needs password + forgot password (see IMPROVEMENTS.md)

## Project Location

`/Users/keithcreelman/Documents/FITFO/coparent-app/`

## Key Files

```
src/
├── app/
│   ├── layout.tsx              # Root layout, PWA meta
│   ├── page.tsx                # Home dashboard (shows "[Name]Sync" header)
│   ├── login/page.tsx          # Magic link login
│   ├── onboarding/page.tsx     # 5-step: profile → name your sync → kids → invite code → calendar
│   ├── calendar/page.tsx       # Month grid calendar with event dots
│   ├── meeting/page.tsx        # Monthly meeting scheduler + private notes + shared agenda
│   ├── import/review/page.tsx  # Screenshot + ICS import review flow
│   ├── invite/page.tsx         # Invite flow: code entry → privacy disclaimer → auth → join
│   ├── settings/page.tsx       # Profile, household, invite code display, calendar connections
│   ├── auth/callback/route.ts  # Supabase auth callback
│   └── api/
│       ├── parse-nlp/route.ts       # Claude API — natural language → event JSON
│       └── parse-screenshot/route.ts # Claude Vision — image → event JSON
├── components/
│   ├── BottomNav.tsx           # Mobile bottom navigation with FAB quick-add button
│   ├── QuickAdd.tsx            # NLP input + structured form + import options modal
│   ├── EventCard.tsx           # Event display card with category colors
│   ├── PrivacyDisclaimer.tsx   # Full-screen privacy notice (shown to invited co-parent)
│   └── CalendarPrivacyPopup.tsx # Calendar connection privacy modal
├── lib/
│   ├── supabase-browser.ts     # Browser Supabase client
│   ├── supabase-server.ts      # Server Supabase client
│   └── types.ts                # All TypeScript types, category labels/colors
├── middleware.ts                # Auth guard, redirects unauthenticated to /login
supabase/
├── migrations/
│   ├── 001_initial_schema.sql  # Full schema: 13 tables, indexes, RLS policies
│   └── 002_invite_codes.sql    # Added invite_code to households
└── email-templates/
    ├── confirm-signup.html     # Branded signup confirmation email
    └── magic-link.html         # Branded magic link email
```

## Database Schema (Supabase)

Tables: households (with invite_code), profiles, household_members (with privacy_acknowledged_at), children, events, event_children, meeting_schedules, meeting_instances, discussion_notes (private until promoted), imports, calendar_connections, notifications, audit_log

All tables have Row Level Security. Household isolation enforced at DB level via `get_my_household_ids()` helper function. Private discussion notes only visible to creator until `is_private = false`.

## Supabase Project

- URL: `https://lpnuduatqetobznzvcyj.supabase.co`
- Schema is deployed (both migrations run)
- Email auth enabled with magic links
- Email templates need updating in dashboard (branded versions in `/supabase/email-templates/`)

## What's Built and Working

- [x] Auth (magic link sign-in)
- [x] Onboarding (profile → household name with "[Name]Sync" branding → add children → invite code generation → calendar connect)
- [x] Privacy disclaimer (full-screen, shown to invited parent before auth)
- [x] Calendar privacy popup (shown when connecting Google Calendar)
- [x] Home dashboard (upcoming events, quick actions)
- [x] Shared calendar (month grid, day selection, event cards, category filtering)
- [x] Quick add (NLP mode with Claude parsing + structured form)
- [x] Import pipeline (ICS file parsing + screenshot import via Claude Vision)
- [x] Monthly meeting system (schedule setup with backup time, private prep notes, promote to shared agenda)
- [x] Invite system (6-char invite codes, shareable links, manual code entry, settings reshare)
- [x] Settings (profile, household, invite code display, calendar connections placeholder)
- [x] TypeScript compiles clean, dev server runs

## What's NOT Built Yet

- [ ] Password-based auth + forgot password + remember me (see IMPROVEMENTS.md #2)
- [ ] Google Calendar OAuth + two-way sync
- [ ] Pull existing calendar events for selective import (see IMPROVEMENTS.md #3)
- [ ] Push notifications (web push API)
- [ ] Email forwarding intake
- [ ] PDF import
- [ ] Vercel deployment
- [ ] Service worker for offline support
- [ ] PWA install prompt

## Important Design Decisions

1. **"[Name]Sync" branding** — the app is FamSync but each household names their own instance (e.g. "CreelSync"). Shown in header, invite flow, privacy disclaimer.
2. **Privacy disclaimer is mandatory** — invited parents see it BEFORE auth. Cannot proceed without acknowledging. Stored as `privacy_acknowledged_at` timestamp.
3. **Private notes stay private** — discussion notes default to `is_private = true`. Creator must explicitly promote to shared agenda.
4. **Invite codes over email invites** — 6-char alphanumeric codes (no ambiguous chars 0/O/1/I). Shareable via text, email, in person. Available in Settings for resharing.
5. **Universal import pipeline** — all imports flow through: source → extract → review → confirm → save. User always reviews before anything is saved.

## Reference Documents

- `BUSINESS-PLAYBOOK.md` — Full market analysis, SWOT, competitive landscape, monetization strategy, integration roadmap, go-to-market plan
- `IMPROVEMENTS.md` — Tracked improvement items with technical details
- `.claude/plans/zippy-squishing-eich.md` — Original build plan with full architecture, schema, screen flow

## Keith's Preferences

- Direct, no-BS approach. No generic startup fluff.
- Strong vanilla HTML/CSS/JS background, learning React/Next.js through this project
- Uses Vercel for hosting, Supabase for databases, Anthropic SDK for AI
- Iterative builder (v0.1 through v0.5 style)
- The FITFO brand: "Whatever your problem, we'll figure it the F out."
