const HOME_LOGIN_WELCOME_ID_KEY = "zerodrive-home-login-welcome-id";
const HOME_LOGIN_WELCOME_SHOWN_KEY = "zerodrive-home-login-welcome-shown-id";

function createWelcomeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function queueHomeLoginWelcome(): void {
  try {
    const welcomeId = createWelcomeId();
    sessionStorage.setItem(HOME_LOGIN_WELCOME_ID_KEY, welcomeId);
    sessionStorage.removeItem(HOME_LOGIN_WELCOME_SHOWN_KEY);
  } catch {
    // Session storage can be unavailable in restricted browser modes.
    // The app should still sign in normally without the one-time greeting.
  }
}

export function hasPendingHomeLoginWelcome(): boolean {
  try {
    const welcomeId = sessionStorage.getItem(HOME_LOGIN_WELCOME_ID_KEY);
    if (!welcomeId) return false;

    return sessionStorage.getItem(HOME_LOGIN_WELCOME_SHOWN_KEY) !== welcomeId;
  } catch {
    return false;
  }
}

export function markHomeLoginWelcomeShown(): void {
  try {
    const welcomeId = sessionStorage.getItem(HOME_LOGIN_WELCOME_ID_KEY);
    if (welcomeId) {
      sessionStorage.setItem(HOME_LOGIN_WELCOME_SHOWN_KEY, welcomeId);
    }
  } catch {
    // Best-effort UX state only.
  }
}
