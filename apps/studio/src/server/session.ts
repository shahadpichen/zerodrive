import crypto from "node:crypto";

interface ExpiringToken {
  hash: Buffer;
  expiresAt: number;
}

interface SessionRecord extends ExpiringToken {
  csrfToken: string;
}

function createToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token: string): Buffer {
  return crypto.createHash("sha256").update(token).digest();
}

function matches(token: string, expected: Buffer): boolean {
  const actual = hashToken(token);
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

export class StudioSessionStore {
  private launchToken: ExpiringToken | null = null;
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(
    private readonly launchTokenTtlMs: number,
    private readonly sessionTtlMs: number,
  ) {}

  issueLaunchToken(now = Date.now()): string {
    const token = createToken();
    this.launchToken = {
      hash: hashToken(token),
      expiresAt: now + this.launchTokenTtlMs,
    };
    return token;
  }

  exchangeLaunchToken(
    token: string,
    now = Date.now(),
  ): { sessionToken: string; csrfToken: string } | null {
    const launch = this.launchToken;
    this.launchToken = null;
    if (!launch || launch.expiresAt <= now || !matches(token, launch.hash)) {
      return null;
    }

    const sessionToken = createToken();
    const csrfToken = createToken();
    this.sessions.set(hashToken(sessionToken).toString("hex"), {
      hash: hashToken(sessionToken),
      csrfToken,
      expiresAt: now + this.sessionTtlMs,
    });
    return { sessionToken, csrfToken };
  }

  getSession(
    token: string | undefined,
    now = Date.now(),
  ): SessionRecord | null {
    if (!token) return null;
    const key = hashToken(token).toString("hex");
    const session = this.sessions.get(key);
    if (!session || session.expiresAt <= now || !matches(token, session.hash)) {
      this.sessions.delete(key);
      return null;
    }
    return session;
  }

  clear(): void {
    this.launchToken = null;
    this.sessions.clear();
  }
}
