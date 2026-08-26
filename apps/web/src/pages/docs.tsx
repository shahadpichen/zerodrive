import React from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "../components/landing-page/header";
import Footer from "../components/landing-page/footer";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { DocsSearch } from "../components/docs/docs-search";
import {
  docsCategories,
  getPagesInCategory,
} from "../components/docs/docs-content";

function Docs() {
  React.useEffect(() => {
    const previousTitle = document.title;
    document.title = "Documentation · ZeroDrive";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="container relative mx-auto w-full">
      <Header />

      <div className="mx-auto max-w-screen-xl px-5 py-12 sm:px-6 lg:px-[6vw]">
        <section className="mx-auto max-w-4xl pb-8 text-center md:pb-14">
          <h1 className="mt-5 text-3xl leading-tight md:text-4xl">
            Protect your files <br/> without guessing what happens next.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            Start with your first encrypted upload, find a specific task, or
            inspect the privacy and recovery model in detail.
          </p>
          <DocsSearch className="mx-auto mt-8 max-w-2xl text-left" />
        </section>

        <section className="border-y py-8 md:py-10">
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                New to ZeroDrive?
              </p>
              <h2 className="mt-3 text-2xl">Set up a private vault safely.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                Follow the quick start through Google permissions, Recovery &
                Access, your first encrypted upload, and optional sharing.
              </p>
            </div>
            <Link
              to="/docs/how-to-use"
              className="inline-flex h-11 items-center justify-center gap-2 border px-5 text-sm font-semibold transition-colors hover:bg-muted/40"
            >
              Start the quick guide
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <div className="mt-14 space-y-16">
          {docsCategories.map((category) => (
            <section key={category.id} id={category.id}>
              <div className="grid gap-3 md:grid-cols-[0.55fr_1fr] md:items-end">
                <h2 className="text-2xl md:text-3xl">{category.title}</h2>
                <p className="text-sm leading-7 text-muted-foreground md:text-right">
                  {category.description}
                </p>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {getPagesInCategory(category.id).map((page) => (
                  <Link
                    key={page.slug}
                    to={`/docs/${page.slug}`}
                    className="group block"
                  >
                    <Card className="h-full shadow-none transition-colors group-hover:bg-muted/30">
                      <CardHeader className="p-6 md:p-7">
                        <CardTitle className="text-lg leading-6">
                          {page.title}
                        </CardTitle>
                        <CardDescription className="mt-2 leading-6">
                          {page.description}
                        </CardDescription>
                        <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                          Read guide
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <Footer />
    </main>
  );
}

export default Docs;
