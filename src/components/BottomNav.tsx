"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, MessageSquare, Plus, Settings } from "lucide-react";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "#quick-add", icon: Plus, label: "Add", isAction: true },
  { href: "/meeting", icon: MessageSquare, label: "Meeting" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function BottomNav({
  onQuickAdd,
}: {
  onQuickAdd?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-border)] z-50 pb-[env(safe-area-inset-bottom)]">
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
  );
}
