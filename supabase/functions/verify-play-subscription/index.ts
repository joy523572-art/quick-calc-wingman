const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_PACKAGE_NAME = "scientific.calculator.cm";
const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface VerifyRequestBody {
  purchaseToken?: string;
  productId?: string;
  packageName?: string;
  acknowledgeIfNeeded?: boolean;
}

interface SubscriptionLineItem {
  productId?: string;
  expiryTime?: string;
  autoRenewingPlan?: {
    autoRenewEnabled?: boolean;
  };
}

interface PlaySubscriptionV2Response {
  kind?: string;
  subscriptionState?: string;
  acknowledgementState?: string;
  latestOrderId?: string;
  lineItems?: SubscriptionLineItem[];
  canceledStateContext?: Record<string, unknown>;
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeString(value: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function pemToPkcs8Bytes(pem: string): Uint8Array {
  const normalized = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getGoogleAccessToken(serviceAccount: ServiceAccountKey): Promise<string> {
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";
  const nowSeconds = Math.floor(Date.now() / 1000);

  const header = base64UrlEncodeString(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncodeString(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: ANDROID_PUBLISHER_SCOPE,
      aud: tokenUri,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );

  const signingInput = `${header}.${payload}`;
  const pkcs8 = pemToPkcs8Bytes(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signatureBuffer))}`;

  const tokenRes = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google OAuth token exchange failed (${tokenRes.status}): ${errText}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error("Google OAuth response missing access_token.");
  }
  return tokenData.access_token;
}

async function acknowledgeSubscriptionIfNeeded(
  accessToken: string,
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<boolean> {
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}` +
    `/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ developerPayload: "verified-by-edge-function" }),
  });

  return res.ok;
}

async function syncSupabaseProfile(
  authHeader: string | null,
  status: "active" | "cancelled" | "expired" | "inactive",
  productId: string | null,
  expiresAt: string | null,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !authHeader?.startsWith("Bearer ")) {
    return;
  }

  const userToken = authHeader.slice("Bearer ".length).trim();
  const apiKey = serviceRoleKey || anonKey;
  if (!userToken || !apiKey) {
    return;
  }

  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        apikey: apiKey,
      },
    });
    if (!userRes.ok) return;

    const user = (await userRes.json()) as { id?: string; email?: string | null };
    if (!user?.id) return;

    const writeKey = serviceRoleKey || apiKey;
    const writeAuth = serviceRoleKey ? `Bearer ${serviceRoleKey}` : `Bearer ${userToken}`;

    await fetch(`${supabaseUrl}/rest/v1/profiles?on_conflict=id`, {
      method: "POST",
      headers: {
        Authorization: writeAuth,
        apikey: writeKey,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        id: user.id,
        email: user.email ?? null,
        subscription_status: status,
        subscription_tier: status === "active" ? productId : null,
        subscription_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.warn("[verify-play-subscription] Profile sync warning:", err);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const rawServiceAccount = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!rawServiceAccount) {
    return jsonResponse(
      {
        error: "GOOGLE_SERVICE_ACCOUNT_JSON secret is not configured.",
        configured: false,
      },
      503,
    );
  }

  let serviceAccount: ServiceAccountKey;
  try {
    serviceAccount = JSON.parse(rawServiceAccount) as ServiceAccountKey;
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("Missing client_email or private_key.");
    }
  } catch (err) {
    console.error("[verify-play-subscription] Invalid GOOGLE_SERVICE_ACCOUNT_JSON:", err);
    return jsonResponse({ error: "Invalid GOOGLE_SERVICE_ACCOUNT_JSON format." }, 500);
  }

  let body: VerifyRequestBody;
  try {
    body = (await req.json()) as VerifyRequestBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400);
  }

  const purchaseToken = body.purchaseToken?.trim();
  if (!purchaseToken) {
    return jsonResponse({ error: "purchaseToken is required." }, 400);
  }

  const packageName = body.packageName?.trim() || DEFAULT_PACKAGE_NAME;
  const fallbackProductId = body.productId?.trim() || "premium_monthly";

  try {
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const playUrl =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}` +
      `/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

    const playRes = await fetch(playUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (playRes.status === 404 || playRes.status === 410) {
      await syncSupabaseProfile(req.headers.get("authorization"), "cancelled", null, null);
      return jsonResponse({
        active: false,
        status: "cancelled",
        productId: fallbackProductId,
        expiresAt: null,
        autoRenewing: false,
        acknowledged: false,
      });
    }

    if (!playRes.ok) {
      const errorText = await playRes.text();
      console.error("[verify-play-subscription] Google Play API error:", playRes.status, errorText);
      return jsonResponse(
        { error: "Failed to verify purchase with Google Play Developer API." },
        502,
      );
    }

    const playData = (await playRes.json()) as PlaySubscriptionV2Response;
    const lineItem = playData.lineItems?.[0];
    const resolvedProductId = lineItem?.productId || fallbackProductId;
    const expiresAt = lineItem?.expiryTime || null;
    const expiresMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
    const notExpired = Number.isNaN(expiresMs) || expiresMs > Date.now();
    const state = playData.subscriptionState || "SUBSCRIPTION_STATE_UNSPECIFIED";
    const autoRenewing = Boolean(lineItem?.autoRenewingPlan?.autoRenewEnabled);

    const isStateActive =
      state === "SUBSCRIPTION_STATE_ACTIVE" ||
      state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" ||
      (state === "SUBSCRIPTION_STATE_CANCELED" && notExpired);

    let status: "active" | "cancelled" | "expired" | "inactive" = "inactive";
    if (isStateActive) {
      status = "active";
    } else if (state === "SUBSCRIPTION_STATE_CANCELED" || state === "SUBSCRIPTION_STATE_REVOKED") {
      status = "cancelled";
    } else if (state === "SUBSCRIPTION_STATE_EXPIRED" || !notExpired) {
      status = "expired";
    }

    let acknowledged = playData.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
    if (
      isStateActive &&
      !acknowledged &&
      body.acknowledgeIfNeeded !== false
    ) {
      acknowledged = await acknowledgeSubscriptionIfNeeded(
        accessToken,
        packageName,
        resolvedProductId,
        purchaseToken,
      );
    }

    await syncSupabaseProfile(
      req.headers.get("authorization"),
      status,
      resolvedProductId,
      expiresAt,
    );

    return jsonResponse({
      active: isStateActive,
      status,
      subscriptionState: state,
      productId: resolvedProductId,
      expiresAt,
      autoRenewing,
      acknowledged,
      orderId: playData.latestOrderId ?? null,
    });
  } catch (err) {
    console.error("[verify-play-subscription] Verification error:", err);
    return jsonResponse({ error: "Internal subscription verification error." }, 500);
  }
});
