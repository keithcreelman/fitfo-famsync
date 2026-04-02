"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import PrivacyDisclaimer from "@/components/PrivacyDisclaimer";
import { Loader2, CheckCircle, Mail } from "lucide-react";

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramHouseholdId = searchParams.get("h");
  const paramCode = searchParams.get("code");
  const supabase = createClient();

  const [step, setStep] = useState<"loading" | "enter_code" | "privacy" | "auth" | "confirm" | "done">("loading");
  const [householdId, setHouseholdId] = useState<string | null>(paramHouseholdId);
  const [inviterName, setInviterName] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [childrenNames, setChildrenNames] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [codeError, setCodeError] = useState("");

  async function lookupHousehold(hId: string) {
    // Load household info
    const { data: household } = await supabase
      .from("households")
      .select("id, name, created_by")
      .eq("id", hId)
      .single();

    if (!household) return false;

    setHouseholdId(household.id);
    setHouseholdName(household.name);

    // Get inviter's name
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", household.created_by)
      .single();
    setInviterName(inviterProfile?.display_name || "Someone");

    // Get children names
    const { data: children } = await supabase
      .from("children")
      .select("name")
      .eq("household_id", household.id);
    setChildrenNames(children?.map((c) => c.name) || []);

    return true;
  }

  async function lookupByCode(code: string) {
    const { data: household } = await supabase
      .from("households")
      .select("id, name, created_by")
      .eq("invite_code", code.toUpperCase().trim())
      .single();

    if (!household) return false;

    setHouseholdId(household.id);
    setHouseholdName(household.name);

    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", household.created_by)
      .single();
    setInviterName(inviterProfile?.display_name || "Someone");

    const { data: children } = await supabase
      .from("children")
      .select("name")
      .eq("household_id", household.id);
    setChildrenNames(children?.map((c) => c.name) || []);

    return true;
  }

  const loadInvite = useCallback(async () => {
    // Check if user is already logged in
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Try code first, then household ID
    if (paramCode) {
      const found = await lookupByCode(paramCode);
      if (!found) {
        setStep("enter_code");
        setCodeError("Invalid invite code. Try entering it manually.");
        return;
      }
    } else if (paramHouseholdId) {
      const found = await lookupHousehold(paramHouseholdId);
      if (!found) {
        setStep("enter_code");
        return;
      }
    } else {
      // No code or ID — show manual code entry
      setStep("enter_code");
      return;
    }

    if (user) {
      setStep("confirm");
    } else {
      setStep("privacy");
    }
  }, [paramCode, paramHouseholdId, supabase]);

  useEffect(() => {
    loadInvite();
  }, [loadInvite]);

  async function handlePrivacyAccept() {
    setStep("auth");
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/invite?${paramCode ? `code=${paramCode}` : `h=${householdId}`}`,
      },
    });

    if (!error) {
      setEmailSent(true);
    }
    setLoading(false);
  }

  async function handleJoinHousehold() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !householdId) return;

    // Check for existing pending membership
    const { data: existing } = await supabase
      .from("household_members")
      .select("id")
      .eq("household_id", householdId)
      .eq("invite_email", user.email)
      .single();

    if (existing) {
      // Update existing invite
      await supabase
        .from("household_members")
        .update({
          user_id: user.id,
          invite_status: "accepted",
          joined_at: new Date().toISOString(),
          privacy_acknowledged_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // Create new membership
      await supabase.from("household_members").insert({
        household_id: householdId,
        user_id: user.id,
        role: "parent",
        invite_status: "accepted",
        joined_at: new Date().toISOString(),
        privacy_acknowledged_at: new Date().toISOString(),
      });
    }

    // Ensure profile exists — use test ID instead of real email
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    const testId = `test${(count || 0) + 1}`;

    // Only create profile if it doesn't already exist (don't overwrite onboarding data)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from("profiles").insert({
        id: user.id,
        email: testId,
        display_name: `Parent (${testId})`,
      });
    }

    setStep("done");
    setLoading(false);

    // Redirect to home after a moment
    setTimeout(() => router.push("/"), 1500);
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
      </div>
    );
  }

  if (step === "enter_code") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">Join a FamSync</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              Enter the invite code you received.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                Invite code
              </label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value.toUpperCase());
                  setCodeError("");
                }}
                placeholder="e.g. A3BK7R"
                autoFocus
                maxLength={6}
                className="w-full px-4 py-4 border border-[var(--color-border)] rounded-xl bg-white text-center text-2xl font-mono font-bold tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>

            {codeError && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg text-center">
                {codeError}
              </p>
            )}

            <button
              onClick={async () => {
                if (manualCode.length < 4) {
                  setCodeError("Enter the full invite code.");
                  return;
                }
                setLoading(true);
                setCodeError("");
                const found = await lookupByCode(manualCode);
                if (!found) {
                  setCodeError("Code not found. Double-check and try again.");
                  setLoading(false);
                  return;
                }
                // Check if already logged in
                const { data: { user } } = await supabase.auth.getUser();
                setLoading(false);
                if (user) {
                  setStep("confirm");
                } else {
                  setStep("privacy");
                }
              }}
              disabled={loading || manualCode.length < 4}
              className="w-full py-3 px-4 bg-[var(--color-primary)] text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Join"
              )}
            </button>

            <p className="text-center text-xs text-[var(--color-text-secondary)]">
              Don&apos;t have a code?{" "}
              <button
                onClick={() => router.push("/login")}
                className="text-[var(--color-primary)] underline"
              >
                Sign in
              </button>{" "}
              or ask your co-parent to share their invite code.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "privacy") {
    return (
      <PrivacyDisclaimer
        inviterName={inviterName}
        householdName={householdName}
        onAccept={handlePrivacyAccept}
      />
    );
  }

  if (step === "auth") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">Join {householdName}</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              Sign in to start coordinating with {inviterName}.
            </p>
          </div>

          {emailSent ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-green-900 mb-1">
                Check your email
              </h2>
              <p className="text-green-700 text-sm">
                Click the sign-in link in your email to continue joining.
              </p>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                  Your email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    className="w-full pl-11 pr-4 py-3 border border-[var(--color-border)] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 bg-[var(--color-primary)] text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Send sign-in link"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold mb-2">Join {householdName}?</h1>
          <p className="text-[var(--color-text-secondary)] mb-2">
            {inviterName} invited you to coordinate family schedules.
          </p>
          {childrenNames.length > 0 && (
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              Children: {childrenNames.join(", ")}
            </p>
          )}
          <button
            onClick={handleJoinHousehold}
            disabled={loading}
            className="w-full py-3 bg-[var(--color-primary)] text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Join Household"
            )}
          </button>
        </div>
      </div>
    );
  }

  // Done
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold">You&apos;re in!</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Redirecting to your family dashboard...
        </p>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}
