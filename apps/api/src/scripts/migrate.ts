import { closePool, runMigrations } from "../config/database";

const migrate = async (): Promise<void> => {
  try {
    await runMigrations();
    process.stdout.write("Database migrations completed successfully.\n");
  } finally {
    await closePool();
  }
};

migrate().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`Database migration failed: ${message}\n`);
  process.exitCode = 1;
});
