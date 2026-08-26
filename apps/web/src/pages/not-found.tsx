import { Link } from "react-router-dom";
import Footer from "../components/landing-page/footer";
import Header from "../components/landing-page/header";
import { Button } from "../components/ui/button";

export default function NotFound() {
  return (
    <main className="container relative mx-auto min-h-screen w-full">
      <Header />
      <section className="mx-auto flex min-h-[62vh] max-w-3xl flex-col items-center justify-center px-5 py-20 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-5 text-3xl leading-tight md:text-4xl">
          This page could not be found.
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
          The link may be outdated, or the page may have moved. You can return
          to ZeroDrive or continue with the documentation.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/">Return to ZeroDrive</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/docs">Browse documentation</Link>
          </Button>
        </div>
      </section>
      <Footer />
    </main>
  );
}
