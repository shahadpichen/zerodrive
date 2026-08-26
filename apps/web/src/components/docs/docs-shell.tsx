import React from "react";
import { Menu, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { DocsNavigation } from "./docs-navigation";
import { DocsSearchDialog } from "./docs-search";
import type { DocsPage } from "./docs-content";
import { cn } from "../../lib/utils";

interface DocsShellProps {
  page: DocsPage;
  activeSection?: string;
  children: React.ReactNode;
}

export function DocsShell({ page, activeSection, children }: DocsShellProps) {
  const [navigationOpen, setNavigationOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const desktopNavigationRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const viewport = desktopNavigationRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    if (!viewport) return;

    const containWheelAtBoundary = (event: WheelEvent) => {
      const maximumScroll = viewport.scrollHeight - viewport.clientHeight;
      if (maximumScroll <= 1) return;

      const reachedTop = viewport.scrollTop <= 0 && event.deltaY < 0;
      const reachedBottom =
        viewport.scrollTop >= maximumScroll - 1 && event.deltaY > 0;
      if (!reachedTop && !reachedBottom) return;

      event.preventDefault();
      event.stopPropagation();
    };

    viewport.addEventListener("wheel", containWheelAtBoundary, {
      passive: false,
    });
    return () => viewport.removeEventListener("wheel", containWheelAtBoundary);
  }, []);

  return (
    <div className="mx-auto max-w-[1500px] py-8">
      <div className="mb-8 flex items-center justify-between border-b pb-5 lg:hidden">
        <Link to="/docs" className="text-sm font-semibold">
          Documentation
        </Link>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            Search
          </Button>
          <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Menu className="h-4 w-4" />
                Browse docs
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="overflow-y-auto px-5">
              <SheetHeader className="mb-6 pr-8">
                <SheetTitle>ZeroDrive documentation</SheetTitle>
                <SheetDescription>
                  Choose a guide by topic.
                </SheetDescription>
              </SheetHeader>
              <DocsNavigation
                currentPage={page}
                compact
                onNavigate={() => setNavigationOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[16rem_minmax(0,1fr)_15rem] xl:gap-20">
        <aside className="hidden min-h-0 lg:block">
          <div className="sticky top-6 h-[calc(100vh-3rem)]">
            <ScrollArea
              ref={desktopNavigationRef}
              className="h-full [&_[data-radix-scroll-area-viewport]]:overscroll-contain"
            >
              <div className="pb-10 pr-5">
                <Button
                  type="button"
                  variant="outline"
                  className="mb-6 h-10 w-full justify-between rounded-none px-3 text-xs xl:hidden"
                  onClick={() => setSearchOpen(true)}
                >
                  <span className="inline-flex items-center gap-2">
                    <Search className="h-3.5 w-3.5" />
                    Search docs
                  </span>
                  <kbd className="text-[10px] font-normal text-muted-foreground">
                    ⌘ K
                  </kbd>
                </Button>
                <DocsNavigation currentPage={page} compact />
              </div>
            </ScrollArea>
          </div>
        </aside>

        <div className="min-w-0">{children}</div>

        <aside className="hidden xl:block">
          <div className="sticky top-6 border-l pl-5">
            <nav aria-label="On this page">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                On this page
              </p>
              <ul className="mt-4 space-y-2.5">
                {page.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={cn(
                        "block text-xs leading-5 text-muted-foreground transition-colors hover:text-foreground",
                        section.level === 3 && "pl-3",
                        activeSection === section.id &&
                          "font-semibold text-foreground",
                      )}
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-7 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full justify-between rounded-none px-3 text-xs"
                onClick={() => setSearchOpen(true)}
              >
                <span className="inline-flex items-center gap-2">
                  <Search className="h-3.5 w-3.5" />
                  Search docs
                </span>
                <kbd className="text-[10px] font-normal text-muted-foreground">
                  ⌘ K
                </kbd>
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <DocsSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
