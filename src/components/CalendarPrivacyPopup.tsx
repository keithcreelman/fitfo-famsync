"use client";

import { X, Check, Calendar } from "lucide-react";

interface CalendarPrivacyPopupProps {
  isOpen: boolean;
  onConnect: () => void;
  onSkip: () => void;
}

export default function CalendarPrivacyPopup({
  isOpen,
  onConnect,
  onSkip,
}: CalendarPrivacyPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6">
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden">
        <div className="p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
              <Calendar className="w-7 h-7 text-[var(--color-primary)]" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-center text-[var(--color-text)] mb-4">
            About Calendar Connection
          </h2>

          <p className="text-center text-[var(--color-text-secondary)] mb-5 text-base">
            Connecting your calendar lets the app add shared family events to
            YOUR calendar automatically.
          </p>

          {/* What this means */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
              What this means:
            </h3>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 bg-green-50 rounded-full flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-[var(--color-text)] text-base pt-0.5">
                Shared family events get added to your calendar
              </p>
            </div>
          </div>

          {/* What this does NOT mean */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
              What this does NOT mean:
            </h3>
            <div className="space-y-2.5">
              {[
                "Nobody can see your existing calendar events",
                "Nobody can see your schedule",
                "Your personal events are never imported or visible to anyone",
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-red-50 rounded-full flex items-center justify-center shrink-0">
                    <X className="w-4 h-4 text-red-500" />
                  </div>
                  <p className="text-[var(--color-text)] text-base pt-0.5">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-[var(--color-text-secondary)] text-center mb-5">
            You can disconnect at any time in Settings.
          </p>

          {/* Buttons — equally prominent */}
          <div className="flex gap-3">
            <button
              onClick={onSkip}
              className="flex-1 py-3.5 px-4 border-2 border-[var(--color-border)] text-[var(--color-text)] font-semibold rounded-xl text-base hover:bg-gray-50 transition-colors"
            >
              Skip for Now
            </button>
            <button
              onClick={onConnect}
              className="flex-1 py-3.5 px-4 bg-[var(--color-primary)] text-white font-semibold rounded-xl text-base hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
