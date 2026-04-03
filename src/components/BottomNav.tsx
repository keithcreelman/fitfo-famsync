"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Calendar, Plus, MoreHorizontal, X, Settings, MessageSquare, Camera, FileText, Users } from "lucide-react";

export default function BottomNav({
  onQuickAdd,
}: {
  onQuickAdd?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/calendar", icon: Calendar, label: "Calendar" },
    { href: "#quick-add", icon: Plus, label: "Add", isAction: true },
    { href: "#more", icon: MoreHorizontal, label: "More", isMenu: true },
  ];

  const menuItems = [
    { href: "/import/review?type=screenshot", icon: Camera, label: "Import Image / PDF", desc: "Photos, flyers, school calendars" },
    { href: "/import/review?type=ics", icon: FileText, label: "Import ICS / Calendar Feed", desc: "Upload ICS file or manage feed subscriptions" },
    { href: "/import/review?type=csv", icon: FileText, label: "Import CSV / Excel", desc: "Spreadsheets from TeamSnap, etc." },
    { href: "/meeting", icon: MessageSquare, label: "Schedule Meeting", desc: "Monthly parent check-in" },
    { href: "/settings", icon: Settings, label: "Settings", desc: "Profile, household, notifications" },
  ];

  return (
    <>
      {/* Options menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <div className="relative w-full max-w-lg mx-auto bg-white rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-semibold">Options</h3>
              <button onClick={() => setMenuOpen(false)} className="p-1">
                <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </button>
            </div>
            <div className="py-1">
              {menuItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(item.href);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                    <item.icon className="w-4.5 h-4.5 text-[var(--color-text-secondary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-border)] z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {navItems.map((item) => {
            if (item.isAction) {
              return (
                <button
                  key={item.label}
                  onClick={onQuickAdd}
                  className="flex flex-col items-center justify-center -mt-5"
                >
                  <div className="w-14 h-14 bg-[var(--color-primary)] rounded-full flex items-center justify-center shadow-lg">
                    <Plus className="w-7 h-7 text-white" />
                  </div>
                </button>
              );
            }

            if (item.isMenu) {
              return (
                <button
                  key={item.label}
                  onClick={() => setMenuOpen(true)}
                  className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 ${
                    menuOpen
                      ? "text-[var(--color-primary)]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  <MoreHorizontal className="w-6 h-6" />
                  <span className="text-xs font-medium">More</span>
                </button>
              );
            }

            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 ${
                  isActive
                    ? "text-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
