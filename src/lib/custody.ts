import { isSameDay, startOfDay, differenceInDays } from "date-fns";

// Custody schedule logic
// Mon/Tue = Mom (Jen), Wed/Thu = Dad (Keith)
// Alternating weekends (Fri-Sun), Keith gets April 3-5 2026 and alternates from there

// Reference weekend: Keith has kids April 3-5, 2026 (Fri-Sun)
const KEITH_REFERENCE_WEEKEND = new Date(2026, 3, 3); // April 3, 2026

export type CustodyParent = "dad" | "mom";

export function getCustodyParent(date: Date): CustodyParent {
  const day = date.getDay(); // 0=Sun, 1=Mon, ... 6=Sat

  // Mon/Tue = Mom
  if (day === 1 || day === 2) return "mom";

  // Wed/Thu = Dad
  if (day === 3 || day === 4) return "dad";

  // Fri/Sat/Sun = alternating weekends
  // Find which Friday this weekend belongs to
  let friday: Date;
  if (day === 5) {
    friday = startOfDay(date);
  } else if (day === 6) {
    friday = startOfDay(new Date(date.getTime() - 24 * 60 * 60000));
  } else {
    // Sunday
    friday = startOfDay(new Date(date.getTime() - 2 * 24 * 60 * 60000));
  }

  // Count weeks since reference Friday (April 3, 2026)
  const refFriday = startOfDay(KEITH_REFERENCE_WEEKEND);
  const daysDiff = differenceInDays(friday, refFriday);
  const weeksDiff = Math.floor(daysDiff / 7);

  // Even weeks = Dad, Odd weeks = Mom
  return weeksDiff % 2 === 0 ? "dad" : "mom";
}

export function getCustodyLabel(parent: CustodyParent): string {
  return parent === "dad" ? "Dad's day" : "Mom's day";
}

export function getCustodyName(parent: CustodyParent): string {
  return parent === "dad" ? "Keith" : "Jen";
}

// Check if a parent is the basketball coach (Jen coaches Annabelle's basketball)
// This means Jen is always assigned to Annabelle's basketball events regardless of custody
export function isCoachOverride(
  parentName: string,
  eventTitle: string,
  childName: string,
  category: string
): boolean {
  const isBasketball = category === "basketball" ||
    eventTitle.toLowerCase().includes("basketball") ||
    eventTitle.toLowerCase().includes("breaker") ||
    eventTitle.toLowerCase().includes("lady breaker");
  const isAnnabelle = childName.toLowerCase().includes("annabelle") ||
    childName.toLowerCase().includes("abba");
  const isJen = parentName.toLowerCase() === "jen" || parentName.toLowerCase() === "mom";

  return isBasketball && isAnnabelle && isJen;
}

// Get the responsible parent for an event
export function getResponsibleParent(
  eventDate: Date,
  eventTitle: string,
  childNames: string[],
  category: string
): CustodyParent {
  // Coach override: Jen always does Annabelle's basketball
  for (const childName of childNames) {
    if (isCoachOverride("Jen", eventTitle, childName, category)) {
      return "mom";
    }
  }

  // Default: whoever has custody that day
  return getCustodyParent(eventDate);
}
