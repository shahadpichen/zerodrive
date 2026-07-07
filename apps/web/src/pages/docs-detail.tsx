import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Markdown from "markdown-to-jsx";
import Header from "../components/landing-page/header";
import Footer from "../components/landing-page/footer";
import { Button } from "../components/ui/button";
import { getDocsPage } from "../components/docs/docs-content";

function DocsDetail() {
  const { slug } = useParams();
  const page = getDocsPage(slug);
  const [markdown, setMarkdown] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!page) return;

    let active = true;
    setIsLoading(true);
    setLoadError(null);

    fetch(`${process.env.PUBLIC_URL}/docs/${page.slug}.md`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load ${page.title}`);
        }
        return response.text();
      })
      .then((content) => {
        if (!active) return;
        setMarkdown(content);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "This docs page could not be loaded.",
        );
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page]);

  if (!page) {
    return <Navigate to="/docs" replace />;
  }

  return (
    <main className="container relative mx-auto w-full">
      <Header />

      <div className="mx-auto max-w-screen-xl px-5 py-12 sm:px-6">
        <div className="mb-6">
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            ← All docs
          </Link>
        </div>

        <section className="mx-auto max-w-4xl text-center">
          <h1 className="mx-auto max-w-3xl text-2xl leading-tight sm:text-3xl md:text-4xl">
            {page.title}
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            {page.summary}
          </p>
        </section>

        <nav
          aria-label="Document sections"
          className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-x-5 gap-y-3"
        >
          {page.sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {section.title}
            </a>
          ))}
        </nav>

        <article className="docs-reading mx-auto mt-16 max-w-4xl text-left text-sm leading-7 md:w-[78%] md:text-base [&_code]:border [&_code]:bg-muted/40 [&_code]:px-1.5 [&_code]:py-0.5">
          {isLoading && (
            <p className="text-center text-muted-foreground">Loading docs…</p>
          )}

          {loadError && (
            <div className="border border-destructive/40 bg-destructive/5 p-5 text-center">
              <p className="font-medium text-foreground">
                This docs page could not be loaded.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            </div>
          )}

          {!isLoading && !loadError && (
            <Markdown
              options={{
                forceBlock: true,
              }}
            >
              {markdown}
            </Markdown>
          )}
        </article>

        <section className="mx-auto mt-16 max-w-3xl text-center">
          <h2 className="text-xl">Need another topic?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Go back to the docs library and choose the next part of ZeroDrive
            you want to understand.
          </p>
          <div className="mt-5">
            <Button asChild variant="ghost">
              <Link to="/docs">Back to all docs →</Link>
            </Button>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  );
}

export default DocsDetail;
