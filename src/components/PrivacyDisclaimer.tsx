"use client";

import { Shield, X, Check, Eye, MapPin, Phone, Mail } from "lucide-react";

interface PrivacyDisclaimerProps {
  inviterName: string;
  householdName?: string;
  onAccept: () => void;
}

export default function PrivacyDisclaimer({
  inviterName,
  householdName,
  onAccept,
}: PrivacyDisclaimerProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Shield icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-green-600" />
          </div>
        </div>

        {/* Family name */}
        {householdName && (
          <h1 className="text-3xl font-bold text-center text-[var(--color-primary)] mb-1">
            {householdName}
          </h1>
        )}
        <p className="text-center text-[10px] text-[var(--color-text-secondary)] uppercase tracking-widest mb-4">
          Powered by FamSync
        </p>

        {/* Title */}
        <h2 className="text-xl font-bold text-center text-[var(--color-text)] mb-2">
          Your Privacy Is Protected
        </h2>

        <p className="text-center text-[var(--color-text-secondary)] mb-8 text-lg">
          {inviterName} invited you to coordinate your family&apos;s schedule
          together.
        </p>

        {/* What it CANNOT do */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
            This app CANNOT:
          </h2>
          <div className="space-y-3">
            {[
              {
                icon: Eye,
                text: "No one can see your personal calendar, emails, or contacts",
              },
              {
                icon: Mail,
                text: "No one can read your private notes until YOU choose to share",
              },
              {
                icon: Phone,
                text: "No one can access your phone, photos, messages, or accounts",
              },
              {
                icon: MapPin,
                text: "No one can track your location",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <X className="w-4 h-4 text-red-500" />
                </div>
                <p className="text-[var(--color-text)] text-base leading-snug pt-1">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* What it DOES do */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
            What it DOES do:
          </h2>
          <div className="space-y-3">
            {[
              "Shared family calendar for kids' events and appointments",
              "Private space to prepare topics for monthly parent check-ins",
              "Optional: sync shared events to your own calendar (one-way out)",
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-[var(--color-text)] text-base leading-snug pt-1">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Key statement */}
        <div className="bg-gray-50 rounded-2xl p-5 mb-6 text-center">
          <p className="text-[var(--color-text)] font-semibold text-lg">
            You control what you share.
          </p>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Nothing is shared without your explicit action.
          </p>
        </div>

        {/* Accept button */}
        <button
          onClick={onAccept}
          className="w-full py-4 px-4 bg-[var(--color-primary)] text-white font-semibold rounded-xl text-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          I Understand — Continue
        </button>

        {/* Privacy policy link */}
        <p className="text-center mt-4">
          <a
            href="/privacy"
            className="text-sm text-[var(--color-primary)] underline"
          >
            Read full privacy policy
          </a>
        </p>
      </div>
    </div>
  );
}
