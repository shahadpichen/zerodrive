import React from "react";
import { Link } from "react-router-dom";
import Markdown from "markdown-to-jsx";
import Header from "../components/landing-page/header";
import Footer from "../components/landing-page/footer";
import { privacyPolicy } from "../components/privacy-content";
import { Button } from "../components/ui/button";

const sectionId = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const privacyNav = [
  "What ZeroDrive asks Google for",
  "Files and vault metadata",
  "Recovery phrase and local browser storage",
  "Sharing and recipient privacy",
  "Analytics, logs, and diagnostics",
];

const privacyMarkdown = privacyPolicy
  .map(
    (section) =>
      `<h2 id="${sectionId(section.heading)}">${section.heading}</h2>\n\n${section.content}`,
  )
  .join("\n\n");

function Privacy() {
  return (
    <main className="container mx-auto w-full relative bg-background text-foreground">
      <Header />

      <div className="mx-auto max-w-screen-xl px-5 py-12 sm:px-6">
        <section className="mx-auto max-w-4xl text-center">
          <h1 className="mx-auto max-w-3xl text-2xl leading-tight sm:text-3xl md:text-4xl">
            Privacy Policy
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            How ZeroDrive uses Google access, encrypted vault data, sharing
            records, and local browser storage.
          </p>
        </section>

        <nav
          aria-label="Privacy policy sections"
          className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-x-5 gap-y-3"
        >
          {privacyNav.map((heading) => (
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
            {privacyMarkdown}
          </Markdown>
        </article>

        <section className="mx-auto mt-16 max-w-3xl text-center">
          <h2 className="text-xl">Need the legal terms?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Read the rules for using ZeroDrive as an encryption layer on top of
            your Google Drive.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button asChild variant="ghost">
              <Link to="/terms">Read Terms of Service →</Link>
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

export default Privacy;
