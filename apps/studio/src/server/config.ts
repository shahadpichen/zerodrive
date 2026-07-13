import { isIP } from "node:net";
import type { StudioProfile } from "../shared/types";

const LOCAL_DATABASE_URL =
  "postgresql://zerodrive_app:localdev123@127.0.0.1:5433/zerodrive";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export interface StudioConfig {
  profile: StudioProfile;
  databaseUrl: string;
  host: "127.0.0.1";
  port: number;
  clientOrigin: string;
  launchTokenTtlMs: number;
  sessionTtlMs: number;
  queryTimeoutMs: number;
  maxRows: number;
  isDevelopment: boolean;
}

export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (LOOPBACK_HOSTS.has(normalized)) return true;
  const ipVersion = isIP(normalized);
  return ipVersion === 4
    ? normalized.startsWith("127.")
    : ipVersion === 6 && normalized === "::1";
}

function parsePort(raw: string | undefined): number {
  const port = Number(raw || 4984);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("STUDIO_PORT must be an integer between 1024 and 65535");
  }
  return port;
}

export function loadStudioConfig(
  env: NodeJS.ProcessEnv = process.env,
): StudioConfig {
  const profile: StudioProfile =
    env.STUDIO_PROFILE === "production" ? "production" : "local";
  const databaseUrl = env.STUDIO_DATABASE_URL || LOCAL_DATABASE_URL;

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("STUDIO_DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    throw new Error("STUDIO_DATABASE_URL must use PostgreSQL");
  }
  if (profile === "production" && !env.STUDIO_DATABASE_URL) {
    throw new Error("STUDIO_DATABASE_URL is required in production profile");
  }
  if (profile === "production" && !isLoopbackHostname(parsed.hostname)) {
    throw new Error(
      "Production Studio must connect through a loopback SSH tunnel",
    );
  }

  const isDevelopment = env.NODE_ENV !== "production";
  const port = parsePort(env.STUDIO_PORT);
  const clientOrigin =
    env.STUDIO_CLIENT_ORIGIN ||
    `http://127.0.0.1:${isDevelopment ? 4985 : port}`;
  const origin = new URL(clientOrigin);
  if (!isLoopbackHostname(origin.hostname)) {
    throw new Error("STUDIO_CLIENT_ORIGIN must use a loopback hostname");
  }

  return {
    profile,
    databaseUrl,
    host: "127.0.0.1",
    port,
    clientOrigin: origin.origin,
    launchTokenTtlMs: 60_000,
    sessionTtlMs: 8 * 60 * 60 * 1000,
    queryTimeoutMs: 10_000,
    maxRows: 500,
    isDevelopment,
  };
}
