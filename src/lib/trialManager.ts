/**
 * Records active day on app start and checks trial expiration based on 3 distinct days or 7 calendar days max.
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
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    if (isLifetime) {
      // allow app
      return false;
    } else if (Array.isArray(activeDays) && activeDays.length > 3) {
      // block - used 3 days
      // show lifetime paywall for product lifetime_premium $19.99
      return true;
    } else if (firstOpen > 0 && Date.now() - firstOpen > SEVEN_DAYS) {
      // block - 7 calendar days max
      // show lifetime paywall
      return true;
    } else {
      // allow free trial
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
    const activeDays = JSON.parse(localStorage.getItem('activeDays') || '[]');
    const count = Array.isArray(activeDays) ? activeDays.length : 1;
    const remaining = Math.max(0, 4 - count);
    if (remaining <= 0) return "Trial Ended (3 days used)";
    return `Trial Day ${count}/3 (${remaining} day${remaining === 1 ? "" : "s"} left)`;
  } catch {
    return "Free Trial";
  }
}
