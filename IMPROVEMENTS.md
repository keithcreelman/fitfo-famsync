# FamSync — Improvements & Future Work

Tracked items for post-MVP polish and business-grade readiness.

---

## 1. Branded Email Templates
- [ ] Customize Supabase email templates (confirm signup, magic link, password reset)
- [ ] Subject lines: "Welcome to FamSync", "Your FamSync sign-in link", "Reset your FamSync password"
- [ ] Remove all Supabase branding
- [ ] Templates saved in `/supabase/email-templates/`
- [ ] Consider custom SMTP (Resend) for better deliverability and full control

## 2. Auth Model — Password + Remember Me
**Problem:** Magic-link-only means one sign-up per email, no persistent sessions, and no traditional login flow. Real apps need password-based auth as a primary option with magic link as a fallback.

**Changes needed:**
- [ ] Add password field to signup flow (email + password, not just magic link)
- [ ] Add standard login page with email + password
- [ ] Add "Remember me" checkbox (extends session duration)
- [ ] Add "Forgot password" flow (Supabase supports this natively)
- [ ] Keep magic link as a secondary option ("Sign in without password")
- [ ] Password reset email template (branded)
- [ ] Supabase config: enable email+password provider, set session duration
- [ ] Consider adding Google OAuth as third option

**Supabase settings to change:**
- Authentication > Providers > Email: enable password-based sign-in
- Authentication > URL Configuration: set redirect URLs
- Authentication > Email Templates: add password reset template

## 3. Calendar Import — Pull Existing Events
**Problem:** Parents already have events scattered across Google Calendar, Apple Calendar, etc. Making them recreate everything manually defeats the purpose. They should be able to pull in existing events selectively.

**Changes needed:**
- [ ] After Google Calendar OAuth connection, fetch existing events from calendar
- [ ] Show a selectable list of upcoming events from their personal calendar
- [ ] Let them check which ones are family-relevant (sports, school, medical, etc.)
- [ ] Selected events import into the shared FamSync calendar
- [ ] Auto-suggest category based on event title (Claude NLP)
- [ ] Auto-match child based on event title if child name appears
- [ ] This is a one-time import flow (onboarding) + available anytime in Settings
- [ ] Privacy: ONLY the events they explicitly select get shared — nothing else is visible
- [ ] Calendar privacy popup must be updated to mention this: "You choose which events to share"

**Technical approach:**
- Google Calendar API: `events.list()` to fetch upcoming events
- Show in a checklist UI with category/child auto-tagging
- User confirms selections → bulk insert into events table with source_type = 'calendar_sync'
- Never store or read events they don't select

---

## Priority Order
1. **Auth model** (P0) — blocking for real usage, can't have a single-use magic link
2. **Calendar import** (P1) — major value-add, reduces friction significantly
3. **Branded templates** (P2) — polish, do alongside auth model changes
