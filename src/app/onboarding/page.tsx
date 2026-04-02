"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  UserPlus,
  Plus,
  X,
} from "lucide-react";
import CalendarPrivacyPopup from "@/components/CalendarPrivacyPopup";

type Step = "profile" | "household" | "children" | "invite" | "calendar" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  // Persist step + data in sessionStorage so it survives re-renders
  const [step, setStepRaw] = useState<Step>(() => {
    if (typeof window !== "undefined") {
      return (sessionStorage.getItem("onboarding_step") as Step) || "profile";
    }
    return "profile";
  });
  const setStep = (s: Step) => {
    console.log("[onboarding] setStep:", s);
    sessionStorage.setItem("onboarding_step", s);
    setStepRaw(s);
  };
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const checkedRef = useRef(false);

  // On mount ONCE: check if user already has a household → redirect to home
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    async function checkExisting() {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("[onboarding] checkExisting - user:", user?.id);
      if (!user) { setCheckingExisting(false); return; }

      const { data: membership, error: memErr } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .eq("invite_status", "accepted")
        .maybeSingle();
      console.log("[onboarding] checkExisting - membership:", membership, "error:", memErr);

      if (membership) {
        console.log("[onboarding] checkExisting - HAS household, redirecting to /");
        sessionStorage.removeItem("onboarding_step");
        sessionStorage.removeItem("onboarding_householdId");
        sessionStorage.removeItem("onboarding_inviteCode");
        router.replace("/");
        return;
      }
      console.log("[onboarding] checkExisting - NO household, showing form");
      setCheckingExisting(false);
    }
    checkExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");

  // Error display
  const [errorMsg, setErrorMsg] = useState("");

  // Household
  const [householdName, setHouseholdName] = useState("");
  const [householdId, setHouseholdId] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("onboarding_householdId") || "";
    }
    return "";
  });

  // Children
  const [children, setChildren] = useState<
    { name: string; nickname: string; grade: string }[]
  >([{ name: "", nickname: "", grade: "" }]);

  // Invite
  const [inviteCode, setInviteCode] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("onboarding_inviteCode") || "";
    }
    return "";
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  // Calendar popup
  const [calendarPopupOpen, setCalendarPopupOpen] = useState(false);

  async function handleProfileNext() {
    if (!displayName.trim()) return;
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.log("[onboarding] handleProfileNext - user:", user?.id);
      if (!user) { setLoading(false); return; }

      // Generate test ID: count existing profiles + 1
      const { count, error: countErr } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      console.log("[onboarding] profile count:", count, "error:", countErr);
      const testId = `test${(count || 0) + 1}`;

      const { error: upsertErr } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: `${displayName.trim()} (${testId})`,
        phone: phone.trim() || null,
        email: testId,
      });
      console.log("[onboarding] profile upsert error:", upsertErr);

      setLoading(false);
      setStep("household");
    } catch (e) {
      console.error("[onboarding] handleProfileNext crashed:", e);
      setLoading(false);
    }
  }

  // Generate a short, readable invite code (6 chars, uppercase alphanumeric, no ambiguous chars)
  function generateInviteCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async function handleHouseholdNext() {
    if (!householdName.trim()) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.log("[onboarding] handleHouseholdNext - user:", user?.id);
      if (!user) { setLoading(false); setErrorMsg("Not logged in. Refresh and try again."); return; }

      const code = generateInviteCode();
      console.log("[onboarding] generated invite code:", code);

      // Step 1: Create household (without invite_code first, in case column is missing)
      const { data: household, error: hhErr } = await supabase
        .from("households")
        .insert({
          name: householdName.trim(),
          created_by: user.id,
        })
        .select()
        .single();
      console.log("[onboarding] household insert:", household?.id, "error:", hhErr);

      if (hhErr || !household) {
        setErrorMsg(`Failed to create household: ${hhErr?.message || "unknown error"}`);
        setLoading(false);
        return;
      }

      // Step 2: Try to set invite_code (may fail if column doesn't exist yet)
      const { error: codeErr } = await supabase
        .from("households")
        .update({ invite_code: code })
        .eq("id", household.id);
      console.log("[onboarding] invite_code update error:", codeErr);
      // Non-fatal — app still works without it, just no invite code shown

      setHouseholdId(household.id);
      sessionStorage.setItem("onboarding_householdId", household.id);
      setInviteCode(codeErr ? "" : code);
      if (!codeErr) sessionStorage.setItem("onboarding_inviteCode", code);

      // Step 3: Add creator as accepted member
      const { error: memberErr } = await supabase.from("household_members").insert({
        household_id: household.id,
        user_id: user.id,
        role: "parent",
        invite_status: "accepted",
        joined_at: new Date().toISOString(),
        privacy_acknowledged_at: new Date().toISOString(),
      });
      console.log("[onboarding] member insert error:", memberErr);

      if (memberErr) {
        setErrorMsg(`Failed to create membership: ${memberErr.message}`);
        setLoading(false);
        return;
      }

      setLoading(false);
      setStep("children");
    } catch (e) {
      console.error("[onboarding] handleHouseholdNext crashed:", e);
      setErrorMsg(`Unexpected error: ${e}`);
      setLoading(false);
    }
  }

  async function handleChildrenNext() {
    const validChildren = children.filter((c) => c.name.trim());
    if (validChildren.length === 0) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    for (const child of validChildren) {
      // Insert child with master name (no nickname on shared record)
      const { data: newChild } = await supabase
        .from("children")
        .insert({
          household_id: householdId,
          name: child.name.trim(),
          grade: child.grade.trim() || null,
        })
        .select()
        .single();

      // Save this parent's nickname separately
      if (newChild && child.nickname.trim() && user) {
        await supabase.from("child_nicknames").insert({
          child_id: newChild.id,
          user_id: user.id,
          nickname: child.nickname.trim(),
        });
      }
    }

    setLoading(false);
    setStep("invite");
  }

  async function handleSendInvite() {
    if (!inviteEmail.trim()) return;
    setLoading(true);

    // Create pending membership for invited co-parent
    await supabase.from("household_members").insert({
      household_id: householdId,
      role: "parent",
      invite_email: inviteEmail.trim().toLowerCase(),
      invite_status: "pending",
    });

    // TODO: Send actual invite email via Resend
    // For now, just mark as sent
    setInviteSent(true);
    setLoading(false);
  }

  function addChild() {
    setChildren([...children, { name: "", nickname: "", grade: "" }]);
  }

  function removeChild(index: number) {
    if (children.length <= 1) return;
    setChildren(children.filter((_, i) => i !== index));
  }

  function updateChild(
    index: number,
    field: "name" | "nickname" | "grade",
    value: string
  ) {
    const updated = [...children];
    updated[index][field] = value;
    setChildren(updated);
  }

  if (checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {(["profile", "household", "children", "invite", "calendar"] as Step[]).map(
            (s) => (
              <div
                key={s}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  s === step
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-border)]"
                }`}
              />
            )
          )}
        </div>

        {/* Step: Profile */}
        {step === "profile" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Welcome to FamSync</h1>
              <p className="text-[var(--color-text-secondary)] mt-1">
                Let&apos;s get you set up in about 2 minutes.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Your name *
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="First name"
                  autoFocus
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="For notifications"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            </div>

            <button
              onClick={handleProfileNext}
              disabled={loading || !displayName.trim()}
              className="w-full py-3 px-4 bg-[var(--color-primary)] text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Continue <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Step: Household */}
        {step === "household" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Name your FamSync</h1>
              <p className="text-[var(--color-text-secondary)] mt-1">
                Every family gets their own. What&apos;s yours called?
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Your FamSync name *
              </label>
              <input
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="e.g. CreelSync, Smith Sync, The Johnsons"
                autoFocus
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">
                Most families use [LastName]Sync — but call it whatever you want.
              </p>
            </div>

            {householdName.trim() && (
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">Preview</p>
                <p className="text-2xl font-bold text-[var(--color-primary)]">
                  {householdName.trim()}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">Powered by FamSync</p>
              </div>
            )}

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("profile")}
                className="py-3 px-4 border border-[var(--color-border)] text-[var(--color-text)] font-semibold rounded-xl"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleHouseholdNext}
                disabled={loading || !householdName.trim()}
                className="flex-1 py-3 px-4 bg-[var(--color-primary)] text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Continue <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step: Children */}
        {step === "children" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Add your children</h1>
              <p className="text-[var(--color-text-secondary)] mt-1">
                Events and notes can be tagged to each child.
              </p>
            </div>

            <div className="space-y-4">
              {children.map((child, i) => (
                <div
                  key={i}
                  className="bg-white border border-[var(--color-border)] rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                      Child {i + 1}
                    </span>
                    {children.length > 1 && (
                      <button
                        onClick={() => removeChild(i)}
                        className="p-1 text-[var(--color-text-secondary)] hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={child.name}
                    onChange={(e) => updateChild(i, "name", e.target.value)}
                    placeholder="Full name *"
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={child.nickname}
                      onChange={(e) =>
                        updateChild(i, "nickname", e.target.value)
                      }
                      placeholder="Your nickname for them"
                      className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                    <input
                      type="text"
                      value={child.grade}
                      onChange={(e) => updateChild(i, "grade", e.target.value)}
                      placeholder="Grade"
                      className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                </div>
              ))}

              <button
                onClick={addChild}
                className="w-full py-3 border-2 border-dashed border-[var(--color-border)] rounded-xl text-[var(--color-text-secondary)] flex items-center justify-center gap-2 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add another child
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("household")}
                className="py-3 px-4 border border-[var(--color-border)] text-[var(--color-text)] font-semibold rounded-xl"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleChildrenNext}
                disabled={
                  loading || !children.some((c) => c.name.trim())
                }
                className="flex-1 py-3 px-4 bg-[var(--color-primary)] text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Continue <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step: Invite */}
        {step === "invite" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-7 h-7 text-[var(--color-primary)]" />
              </div>
              <h1 className="text-2xl font-bold">Invite your co-parent</h1>
              <p className="text-[var(--color-text-secondary)] mt-1">
                Share the link or code — they choose how to join.
              </p>
            </div>

            {/* Invite code - big and prominent */}
            <div className="bg-gray-50 border border-[var(--color-border)] rounded-xl p-5 text-center">
              <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                Invite Code
              </p>
              <p className="text-3xl font-mono font-bold tracking-[0.3em] text-[var(--color-text)]">
                {inviteCode}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteCode);
                  setCopied("code");
                  setTimeout(() => setCopied(null), 2000);
                }}
                className="mt-3 text-sm text-[var(--color-primary)] font-medium"
              >
                {copied === "code" ? "✓ Copied!" : "Copy code"}
              </button>
            </div>

            {/* Invite link */}
            <div className="bg-white border border-[var(--color-border)] rounded-xl p-4">
              <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                Or share this link
              </p>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2.5 bg-gray-50 rounded-lg text-sm text-[var(--color-text-secondary)] truncate font-mono">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/invite?code=${inviteCode}`
                    : `/invite?code=${inviteCode}`}
                </div>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/invite?code=${inviteCode}`;
                    navigator.clipboard.writeText(url);
                    setCopied("link");
                    setTimeout(() => setCopied(null), 2000);
                  }}
                  className="px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg shrink-0"
                >
                  {copied === "link" ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                Send this via text, email, or however works best. They&apos;ll
                see a privacy disclaimer before joining.
              </p>
            </div>

            {/* Optional: also send email invite */}
            <div className="border-t border-[var(--color-border)] pt-4">
              {inviteSent ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-green-800 font-medium text-sm">
                    Invite also sent to {inviteEmail}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                    Want to also send an email invite?
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="co-parent@example.com"
                      className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                    <button
                      onClick={handleSendInvite}
                      disabled={loading || !inviteEmail.trim()}
                      className="px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-xl disabled:opacity-50"
                    >
                      {loading ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("children")}
                className="py-3 px-4 border border-[var(--color-border)] text-[var(--color-text)] font-semibold rounded-xl"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setStep("calendar")}
                className="flex-1 py-3 px-4 bg-[var(--color-primary)] text-white font-semibold rounded-xl flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step: Calendar connect */}
        {step === "calendar" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Connect your calendar</h1>
              <p className="text-[var(--color-text-secondary)] mt-1">
                Shared events can sync to your personal calendar.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setCalendarPopupOpen(true)}
                className="w-full py-4 px-4 bg-white border-2 border-[var(--color-border)] rounded-xl flex items-center gap-4 hover:bg-gray-50 transition-colors"
              >
                <img
                  src="https://www.gstatic.com/images/branding/product/1x/calendar_2020q4_48dp.png"
                  alt="Google Calendar"
                  className="w-10 h-10"
                />
                <div className="text-left">
                  <p className="font-semibold">Google Calendar</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Sync shared events to your Google Calendar
                  </p>
                </div>
              </button>
            </div>

            <button
              onClick={() => {
                sessionStorage.removeItem("onboarding_step");
                sessionStorage.removeItem("onboarding_householdId");
                sessionStorage.removeItem("onboarding_inviteCode");
                router.push("/");
              }}
              className="w-full py-3 px-4 bg-[var(--color-primary)] text-white font-semibold rounded-xl"
            >
              {calendarPopupOpen ? "Finish Setup" : "Skip — I'll do this later"}
            </button>

            <CalendarPrivacyPopup
              isOpen={calendarPopupOpen}
              onConnect={() => {
                // TODO: Initiate Google Calendar OAuth
                setCalendarPopupOpen(false);
                sessionStorage.removeItem("onboarding_step");
                sessionStorage.removeItem("onboarding_householdId");
                sessionStorage.removeItem("onboarding_inviteCode");
                router.push("/");
              }}
              onSkip={() => {
                setCalendarPopupOpen(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
