import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import Markdown from "markdown-to-jsx";
import Header from "../components/landing-page/header";
import Footer from "../components/landing-page/footer";
import { DocsShell } from "../components/docs/docs-shell";
import { Button } from "../components/ui/button";
import {
  getAdjacentDocsPages,
  getDocsCategory,
  getDocsPage,
  slugifyDocsHeading,
} from "../components/docs/docs-content";
import { SITE_NAME, SITE_ORIGIN } from "../lib/site-metadata";
import {
  useActiveDocsHeading,
  type RegisterDocsHeading,
} from "../hooks/use-active-docs-heading";

function nodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return nodeText(node.props.children);
  }
  return "";
}

function DocsHeading({
  level,
  registerHeading,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  level: 2 | 3;
  registerHeading: RegisterDocsHeading;
  children?: React.ReactNode;
}) {
  const id = slugifyDocsHeading(nodeText(children));
  const Component = level === 2 ? "h2" : "h3";
  const setHeadingRef = React.useCallback(
    (element: HTMLHeadingElement | null) => registerHeading(id, element),
    [id, registerHeading],
  );
  return (
    <Component ref={setHeadingRef} id={id} {...props}>
      {children}
    </Component>
  );
}

function DocsDetail() {
  const { slug } = useParams();
  const page = getDocsPage(slug);
  const sectionIds = React.useMemo(
    () => page?.sections.map((section) => section.id) || [],
    [page],
  );
  const { activeSection, registerHeading, registerArticleEnd } =
    useActiveDocsHeading(sectionIds);

  React.useEffect(() => {
    if (!page || window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [page]);

  if (!page) return <Navigate to="/docs" replace />;

  const category = getDocsCategory(page.category);
  const { previous, next } = getAdjacentDocsPages(page);

  return (
    <main className="container relative mx-auto w-full">
      <Header />

      <DocsShell page={page} activeSection={activeSection}>
        <div itemScope itemType="https://schema.org/TechArticle">
        <div className="mb-10">
          <nav
            aria-label="Breadcrumb"
            itemScope
            itemType="https://schema.org/BreadcrumbList"
          >
            <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <li
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
              >
                <Link
                  to="/docs"
                  className="hover:text-foreground hover:underline"
                  itemProp="item"
                >
                  <span itemProp="name">Docs</span>
                </Link>
                <meta itemProp="position" content="1" />
              </li>
              <li aria-hidden="true">/</li>
              <li
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
              >
                <span itemProp="name">{category?.title}</span>
                <meta itemProp="position" content="2" />
              </li>
            </ol>
          </nav>
          <h1
            className="mt-5 text-3xl leading-tight md:text-4xl"
            itemProp="headline"
          >
            {page.title}
          </h1>
          <p
            className="mt-5 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base"
            itemProp="description"
          >
            {page.description}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Reviewed{" "}
            <time itemProp="dateModified" dateTime={page.updated}>
              {page.updated}
            </time>
          </p>
          <meta
            itemProp="mainEntityOfPage"
            content={`${SITE_ORIGIN}/docs/${page.slug}`}
          />
          <span
            itemProp="publisher"
            itemScope
            itemType="https://schema.org/Organization"
          >
            <meta itemProp="name" content={SITE_NAME} />
            <meta itemProp="url" content={SITE_ORIGIN} />
          </span>
        </div>

        <details className="mb-10 border p-4 xl:hidden">
          <summary className="cursor-pointer text-sm font-semibold">
            On this page
          </summary>
          <ul className="mt-4 space-y-2 border-t pt-4">
            {page.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </details>

        <article
          className="docs-reading docs-article min-h-[18rem] text-left text-sm leading-7 md:text-base [&_code]:border [&_code]:bg-muted/40 [&_code]:px-1.5 [&_code]:py-0.5"
          itemProp="articleBody"
        >
          <Markdown
            options={{
              forceBlock: true,
              overrides: {
                h2: {
                  component: (
                    props: React.HTMLAttributes<HTMLHeadingElement>,
                  ) => (
                    <DocsHeading
                      {...props}
                      level={2}
                      registerHeading={registerHeading}
                    />
                  ),
                },
                h3: {
                  component: (
                    props: React.HTMLAttributes<HTMLHeadingElement>,
                  ) => (
                    <DocsHeading
                      {...props}
                      level={3}
                      registerHeading={registerHeading}
                    />
                  ),
                },
              },
            }}
          >
            {page.body}
          </Markdown>
          <span
            ref={registerArticleEnd}
            aria-hidden="true"
            className="block h-px"
          />
        </article>

        <nav
          aria-label="More documentation"
          className="mt-16 grid gap-3 border-t pt-8 sm:grid-cols-2"
        >
          {previous ? (
            <Button
              asChild
              variant="outline"
              className="h-auto justify-start rounded-none p-5 text-left"
            >
              <Link to={`/docs/${previous.slug}`}>
                <span>
                  <span className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <ArrowLeft className="h-3.5 w-3.5" /> Previous
                  </span>
                  <span className="mt-3 block text-sm font-semibold">
                    {previous.title}
                  </span>
                </span>
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {next && (
            <Button
              asChild
              variant="outline"
              className="h-auto justify-end rounded-none p-5 text-right"
            >
              <Link to={`/docs/${next.slug}`}>
                <span>
                  <span className="flex items-center justify-end gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Next <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                  <span className="mt-3 block text-sm font-semibold">
                    {next.title}
                  </span>
                </span>
              </Link>
            </Button>
          )}
        </nav>
        </div>
      </DocsShell>

      <Footer />
    </main>
  );
}

export default DocsDetail;
