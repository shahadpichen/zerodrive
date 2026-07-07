import React from "react";
import { Link } from "react-router-dom";
import Header from "../components/landing-page/header";
import Footer from "../components/landing-page/footer";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { docsPages } from "../components/docs/docs-content";
import { cn } from "../lib/utils";

function Docs() {
  return (
    <main className="container relative mx-auto w-full">
      <Header />

      <div className="mx-auto max-w-screen-xl px-5 py-12 sm:px-6 lg:px-[8vw]">
        <section className="border bg-card p-6 shadow-sm md:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge variant="outline" className="mb-5 bg-muted/30">
                ZeroDrive documentation
              </Badge>
              <h1 className="text-2xl leading-tight sm:text-3xl md:text-4xl">
                Choose what you want to understand about ZeroDrive.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Start with the product model, or jump straight into usage,
                secure sharing, privacy, recovery, security limits, or
                self-hosting. Each topic has its own page so the docs stay easy
                to scan.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button asChild>
                <Link to="/docs/how-it-works">Start with overview</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/docs/self-hosting">Self-hosting notes</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                All docs
              </p>
              <h2 className="mt-2 text-xl md:text-2xl">
                Pick a topic and go deeper
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              The docs are split by intent: learning the product, using the app,
              reviewing security, or running it yourself.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {docsPages.map((page) => {
              return (
                <Link
                  key={page.slug}
                  to={`/docs/${page.slug}`}
                  className="group block"
                >
                  <Card
                    className={cn(
                      "h-full shadow-none transition-colors group-hover:bg-muted/30",
                      page.slug === "if-zerodrive-disappears" && "border-2",
                    )}
                  >
                    <CardHeader className="p-6 md:p-8">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {page.eyebrow}
                      </p>
                      <CardTitle className="mt-3 text-lg">
                        {page.cardTitle}
                      </CardTitle>
                      <CardDescription className="mt-2 leading-6">
                        {page.summary}
                      </CardDescription>
                      <span className="mt-6 inline-flex text-sm font-medium text-foreground">
                        Open doc →
                      </span>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <Footer />
    </main>
  );
}

export default Docs;
