import React from "react";
import { Link } from "react-router-dom";
import Markdown from "markdown-to-jsx";
import Header from "../components/landing-page/header";
import Footer from "../components/landing-page/footer";
import { termsOfService } from "../components/terms-content";
import { Button } from "../components/ui/button";

const sectionId = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const termsNav = [
  "What ZeroDrive is",
  "Google account and Drive access",
  "Your recovery phrase",
  "File sharing",
  "Availability and changes",
];

const termsMarkdown = termsOfService
  .map(
    (section) =>
      `<h2 id="${sectionId(section.heading)}">${section.heading}</h2>\n\n${section.content}`,
  )
  .join("\n\n");

function Terms() {
  return (
    <main className="container mx-auto w-full relative bg-background text-foreground">
      <Header />

      <div className="mx-auto max-w-screen-xl px-5 py-12 sm:px-6">
        <section className="mx-auto max-w-4xl text-center">
          <h1 className="mx-auto max-w-3xl text-2xl leading-tight sm:text-3xl md:text-4xl">
            Terms of Service
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            The rules for using ZeroDrive as an encryption layer on top of your
            own Google Drive.
          </p>
        </section>

        <nav
          aria-label="Terms of service sections"
          className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-x-5 gap-y-3"
        >
          {termsNav.map((heading) => (
            <a
              key={heading}
              href={`#${sectionId(heading)}`}
              className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {heading}
            </a>
          ))}
        </nav>

        <article className="docs-reading mx-auto mt-16 max-w-4xl text-left text-sm leading-7 md:w-[78%] md:text-base [&_code]:border [&_code]:bg-muted/40 [&_code]:px-1.5 [&_code]:py-0.5">
          <Markdown
            options={{
              forceBlock: true,
            }}
          >
            {termsMarkdown}
          </Markdown>
        </article>

        <section className="mx-auto mt-16 max-w-3xl text-center">
          <h2 className="text-xl">Need the privacy details?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Read how ZeroDrive handles Google access, encrypted vault metadata,
            sharing records, and local browser storage.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button asChild variant="ghost">
              <Link to="/privacy">Read Privacy Policy →</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/">Back to ZeroDrive →</Link>
            </Button>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  );
}

export default Terms;
