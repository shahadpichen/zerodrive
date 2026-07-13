import path from "node:path";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { z } from "zod";
import type { StudioConfig } from "./config";
import { StudioDatabase } from "./database";
import { StudioSessionStore } from "./session";

const SESSION_COOKIE = "zerodrive_studio_session";
const identifier = z.string().min(1).max(128);
const values = z.record(z.string(), z.unknown());

declare global {
  namespace Express {
    interface Request {
      studioSession?: { csrfToken: string };
    }
  }
}

function statusForError(error: Error & { code?: string }): number {
  if (error.code === "CONFIRM_DESTRUCTIVE") return 409;
  if (/not found/i.test(error.message)) return 404;
  if (
    /read-only|requires|unknown|invalid|accepts|enter a sql/i.test(
      error.message,
    )
  )
    return 400;
  return 500;
}

function safeMessage(error: Error & { code?: string }): string {
  if (statusForError(error) === 500)
    return "Studio could not complete the database operation";
  return error.message;
}

export interface StudioAppDependencies {
  database: StudioDatabase;
  sessions: StudioSessionStore;
}

export function createStudioApp(
  config: StudioConfig,
  dependencies: StudioAppDependencies,
) {
  const { database, sessions } = dependencies;
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'", "ws://127.0.0.1:4985"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, private");
    next();
  });
  app.use(express.json({ limit: "256kb", strict: true }));
  app.use(cookieParser());

  let requestWindowStartedAt = Date.now();
  let requestsInWindow = 0;
  app.use("/api", (_req, res, next) => {
    const now = Date.now();
    if (now - requestWindowStartedAt >= 60_000) {
      requestWindowStartedAt = now;
      requestsInWindow = 0;
    }
    requestsInWindow += 1;
    if (requestsInWindow > 600) {
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Studio request limit reached; retry shortly",
        },
      });
      return;
    }
    next();
  });

  app.get("/launch", (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const exchanged = sessions.exchangeLaunchToken(token);
    if (!exchanged) {
      res
        .status(401)
        .send("This Studio launch link is invalid or has expired.");
      return;
    }
    res.cookie(SESSION_COOKIE, exchanged.sessionToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
      maxAge: config.sessionTtlMs,
    });
    res.redirect(303, "/");
  });

  const requireSession = (req: Request, res: Response, next: NextFunction) => {
    const session = sessions.getSession(req.cookies?.[SESSION_COOKIE]);
    if (!session) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Launch Studio again" },
      });
      return;
    }
    req.studioSession = { csrfToken: session.csrfToken };
    next();
  };

  const requireMutationSecurity = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (req.get("origin") !== config.clientOrigin) {
      res.status(403).json({
        error: { code: "INVALID_ORIGIN", message: "Request origin rejected" },
      });
      return;
    }
    if (req.get("x-studio-csrf") !== req.studioSession?.csrfToken) {
      res.status(403).json({
        error: {
          code: "INVALID_CSRF",
          message: "Request verification failed",
        },
      });
      return;
    }
    next();
  };

  app.use("/api", requireSession);

  app.get("/api/session", (req, res) => {
    res.json({
      profile: config.profile,
      readOnly: config.profile === "production",
      csrfToken: req.studioSession!.csrfToken,
    });
  });

  app.get("/api/overview", async (_req, res, next) => {
    try {
      res.json(await database.getOverview());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/relations", async (_req, res, next) => {
    try {
      res.json(await database.listRelations());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/relations/:schema/:name", async (req, res, next) => {
    try {
      const params = z
        .object({ schema: identifier, name: identifier })
        .parse(req.params);
      res.json(await database.getRelationDetails(params.schema, params.name));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/relations/:schema/:name/rows", async (req, res, next) => {
    try {
      const params = z
        .object({ schema: identifier, name: identifier })
        .parse(req.params);
      const query = z
        .object({
          offset: z.coerce.number().int().min(0).default(0),
          limit: z.coerce.number().int().min(1).max(100).default(50),
          sort: identifier.optional(),
          direction: z.enum(["asc", "desc"]).optional(),
          filterColumn: identifier.optional(),
          filterValue: z.string().max(500).optional(),
        })
        .parse(req.query);
      res.json(await database.getRows(params.schema, params.name, query));
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/relations/:schema/:name/rows",
    requireMutationSecurity,
    async (req, res, next) => {
      try {
        const params = z
          .object({ schema: identifier, name: identifier })
          .parse(req.params);
        const body = z.object({ values }).strict().parse(req.body);
        res
          .status(201)
          .json(
            await database.insertRow(params.schema, params.name, body.values),
          );
      } catch (error) {
        next(error);
      }
    },
  );

  app.patch(
    "/api/relations/:schema/:name/rows",
    requireMutationSecurity,
    async (req, res, next) => {
      try {
        const params = z
          .object({ schema: identifier, name: identifier })
          .parse(req.params);
        const body = z
          .object({ primaryKey: values, values })
          .strict()
          .parse(req.body);
        res.json(
          await database.updateRow(
            params.schema,
            params.name,
            body.primaryKey,
            body.values,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );

  app.delete(
    "/api/relations/:schema/:name/rows",
    requireMutationSecurity,
    async (req, res, next) => {
      try {
        const params = z
          .object({ schema: identifier, name: identifier })
          .parse(req.params);
        const body = z.object({ primaryKey: values }).strict().parse(req.body);
        await database.deleteRow(params.schema, params.name, body.primaryKey);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  app.post("/api/query", requireMutationSecurity, async (req, res, next) => {
    try {
      const body = z
        .object({
          sql: z.string().min(1).max(100_000),
          confirmDestructive: z.boolean().default(false),
        })
        .strict()
        .parse(req.body);
      res.json(await database.executeQuery(body.sql, body.confirmDestructive));
    } catch (error) {
      next(error);
    }
  });

  const staticDirectory = path.resolve(__dirname, "../../dist");
  if (!config.isDevelopment) {
    app.use(
      express.static(staticDirectory, { index: false, fallthrough: true }),
    );
    app.get("*", (_req, res) =>
      res.sendFile(path.join(staticDirectory, "index.html")),
    );
  }

  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const normalized =
        error instanceof Error ? error : new Error("Unknown Studio error");
      const status =
        error instanceof z.ZodError ? 400 : statusForError(normalized);
      const code =
        (normalized as Error & { code?: string }).code ||
        (status === 500 ? "DATABASE_OPERATION_FAILED" : "INVALID_REQUEST");
      if (status === 500) console.error("[Studio] Database operation failed");
      res
        .status(status)
        .json({ error: { code, message: safeMessage(normalized) } });
    },
  );

  return app;
}
