/**
 * Records active day on app start and checks trial expiration.
 * Users get free access for 2 initial days; on the 3rd day, advanced features
 * require a one-time Lifetime subscription. The scientific calculator remains permanently free.
 */
export function recordActiveDay(): void {
  if (typeof window === "undefined") return;

  try {
    const today = new Date().toDateString();
    let activeDays = JSON.parse(localStorage.getItem('activeDays') || '[]');
    if (!Array.isArray(activeDays)) activeDays = [];

    if (!activeDays.includes(today)) {
      activeDays.push(today);
      localStorage.setItem('activeDays', JSON.stringify(activeDays));
    }

    if (!localStorage.getItem('first_open_date')) {
      localStorage.setItem('first_open_date', Date.now().toString());
    }
  } catch {
    // ignore
  }
}

export function saveFirstOpenTimestamp(ts: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem('first_open_date', ts.toString());
  } catch {
    // ignore
  }
}

export function isAppPermanentlyBlocked(isPro: boolean): boolean {
  if (isPro) return false;

  try {
    if (typeof window === "undefined") return false;

    const activeDays = JSON.parse(localStorage.getItem('activeDays') || '[]');
    const isLifetime =
      localStorage.getItem('lifetime_purchased') === 'true' ||
      localStorage.getItem('billing_status') === 'active' ||
      localStorage.getItem('billing_plan_id') === 'lifetime_premium';
    const firstOpen = parseInt(localStorage.getItem('first_open_date') || '0', 10);
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000; // 48 hours = arrived at the 3rd day

    if (isLifetime) {
      // allow app
      return false;
    } else if (Array.isArray(activeDays) && activeDays.length >= 3) {
      // block on 3rd day
      return true;
    } else if (firstOpen > 0 && Date.now() - firstOpen >= TWO_DAYS_MS) {
      // block on 3rd calendar day (48+ hours elapsed)
      return true;
    } else {
      // allow free trial for first 2 days
      return false;
    }
  } catch {
    return false;
  }
}

export function isWithinTrialPeriod(): boolean {
  return !isAppPermanentlyBlocked(false);
}

export function getFirstOpenTimestamp(): number {
  recordActiveDay();
  const raw = localStorage.getItem('first_open_date');
  if (raw) {
    const p = parseInt(raw, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  return Date.now();
}

export function formatTrialTimeRemaining(): string {
  try {
    if (isAppPermanentlyBlocked(false)) {
      return "Trial Ended (Day 3 reached - Lifetime Required)";
    }
    const activeDays = JSON.parse(localStorage.getItem('activeDays') || '[]');
    const count = Array.isArray(activeDays) ? activeDays.length : 1;
    const remaining = Math.max(0, 3 - count);
    if (remaining <= 0) return "Trial Ended (Day 3 reached - Lifetime Required)";
    return `Trial Day ${count}/2 (${remaining} day left)`;
  } catch {
    return "Free Trial";
  }
}
