import { execFile } from "node:child_process";
import { createStudioApp } from "./app";
import { loadStudioConfig } from "./config";
import { StudioDatabase } from "./database";
import { StudioSessionStore } from "./session";

function openBrowser(url: string): void {
  if (process.env.STUDIO_NO_OPEN === "true") return;
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  execFile(command, args, { windowsHide: true }, () => undefined);
}

async function start(): Promise<void> {
  const config = loadStudioConfig();
  const database = new StudioDatabase(config);
  await database.verifyProductionSafety();
  await database.getOverview();

  const sessions = new StudioSessionStore(
    config.launchTokenTtlMs,
    config.sessionTtlMs,
  );
  const launchToken = sessions.issueLaunchToken();
  const app = createStudioApp(config, { database, sessions });
  const browserPort = config.isDevelopment ? 4985 : config.port;
  const launchUrl = `http://127.0.0.1:${browserPort}/launch?token=${encodeURIComponent(launchToken)}`;

  const server = app.listen(config.port, config.host, () => {
    console.log(`\nZeroDrive Studio (${config.profile})`);
    console.log(`Listening only on http://${config.host}:${config.port}`);
    console.log(`Open this one-time link within 60 seconds:\n${launchUrl}\n`);
    setTimeout(() => openBrowser(launchUrl), config.isDevelopment ? 800 : 100);
  });

  const stop = async () => {
    sessions.clear();
    server.close();
    await database.close();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

start().catch((error) => {
  console.error(
    `[Studio] Startup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
  );
  process.exit(1);
});
