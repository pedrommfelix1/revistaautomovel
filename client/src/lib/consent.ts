const CONSENT_KEY = "autoturbo-ad-consent";

export type AdConsent = "accepted" | "rejected";

export function getAdConsent(): AdConsent | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

export function setAdConsent(value: AdConsent) {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* private browsing, etc. */ }
}
