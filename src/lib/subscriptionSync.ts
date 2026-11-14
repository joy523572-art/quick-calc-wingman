async function getSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return null;
  }
  const mod = await import("@/integrations/supabase/client");
  return mod.supabase;
}

export type SubscriptionStatus = "active" | "inactive" | "cancelled" | "expired";

export interface ProfileSubscriptionRecord {
  subscription_status: SubscriptionStatus;
  subscription_tier: string | null;
  subscription_expires_at: string | null;
}

const LOCAL_SUB_META_KEY = "nume.subscription_profile.v1";

export function computeSubscriptionExpiresAt(productId: string, baseDate = new Date()): string {
  const expires = new Date(baseDate.getTime());
  if (productId === "premium_weekly") {
    expires.setDate(expires.getDate() + 7);
  } else {
    expires.setDate(expires.getDate() + 30);
  }
  return expires.toISOString();
}

export function getTierDisplayName(tier: string | null | undefined, formattedPrice?: string): string {
  if (tier === "premium_monthly" || tier?.toLowerCase().includes("monthly")) {
    return formattedPrice ? `Monthly Subscription (${formattedPrice})` : "Monthly Subscription";
  }
  if (tier === "premium_weekly" || tier?.toLowerCase().includes("weekly")) {
    return formattedPrice ? `Weekly Subscription (${formattedPrice})` : "Weekly Subscription";
  }
  return "Free Plan";
}

export function readLocalSubscriptionMetadata(): ProfileSubscriptionRecord {
  if (typeof window === "undefined") {
    return {
      subscription_status: "inactive",
      subscription_tier: null,
      subscription_expires_at: null,
    };
  }
  try {
    const raw = localStorage.getItem(LOCAL_SUB_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProfileSubscriptionRecord>;
      return {
        subscription_status: (parsed.subscription_status as SubscriptionStatus) || "inactive",
        subscription_tier: parsed.subscription_tier ?? null,
        subscription_expires_at: parsed.subscription_expires_at ?? null,
      };
    }
  } catch {
    // ignore storage errors
  }

  return {
    subscription_status: "inactive",
    subscription_tier: null,
    subscription_expires_at: null,
  };
}

export function saveLocalSubscriptionMetadata(record: ProfileSubscriptionRecord): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_SUB_META_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }
}

export function clearLocalSubscriptionMetadata(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOCAL_SUB_META_KEY);
  } catch {
    // ignore
  }
}

/**
 * Upserts subscription_status, subscription_tier, and subscription_expires_at
 * in Supabase public.profiles when a user session is active.
 */
export async function syncSubscriptionToProfile(
  record: ProfileSubscriptionRecord
): Promise<boolean> {
  saveLocalSubscriptionMetadata(record);

  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return false;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? null,
        subscription_status: record.subscription_status,
        subscription_tier: record.subscription_tier,
        subscription_expires_at: record.subscription_expires_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.warn("[SupabaseSync] Failed to update profile subscription:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[SupabaseSync] Profile sync skipped or unavailable:", err);
    return false;
  }
}

/**
 * Fetches subscription_status, subscription_tier, and subscription_expires_at
 * from Supabase public.profiles for the signed-in user.
 */
export async function fetchProfileSubscription(): Promise<ProfileSubscriptionRecord | null> {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return null;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("subscription_status, subscription_tier, subscription_expires_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const status = (data.subscription_status as SubscriptionStatus) || "inactive";
    const expiresAt = data.subscription_expires_at;
    const isNotExpired = !expiresAt || new Date(expiresAt).getTime() > Date.now();

    const record: ProfileSubscriptionRecord = {
      subscription_status: status === "active" && !isNotExpired ? "expired" : status,
      subscription_tier: data.subscription_tier,
      subscription_expires_at: expiresAt,
    };

    saveLocalSubscriptionMetadata(record);
    return record;
  } catch {
    return null;
  }
}
