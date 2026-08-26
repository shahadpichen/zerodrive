import React from "react";
import { Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { searchDocs } from "./docs-content";
import { cn } from "../../lib/utils";

interface DocsSearchProps {
  className?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
  resultsMode?: "popover" | "inline";
}

export function DocsSearch({
  className,
  autoFocus = false,
  onNavigate,
  resultsMode = "popover",
}: DocsSearchProps) {
  const [query, setQuery] = React.useState("");
  const results = React.useMemo(() => searchDocs(query).slice(0, 8), [query]);
  const hasQuery = query.trim().length > 0;

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search documentation"
          aria-label="Search documentation"
          className="h-11 pl-10 pr-10"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear documentation search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {hasQuery && (
        <div
          className={cn(
            "mt-2 max-h-80 overflow-y-auto border bg-background",
            resultsMode === "popover"
              ? "absolute left-0 right-0 z-40 shadow-lg"
              : "relative max-h-[50vh]",
          )}
        >
          {results.length ? (
            results.map((page) => (
              <Link
                key={page.slug}
                to={`/docs/${page.slug}`}
                onClick={() => {
                  setQuery("");
                  onNavigate?.();
                }}
                className="block border-b px-4 py-3 last:border-b-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
              >
                <span className="block text-sm font-medium">{page.title}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {page.description}
                </span>
              </Link>
            ))
          ) : (
            <p className="px-4 py-5 text-sm text-muted-foreground">
              No documentation matches “{query.trim()}”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface DocsSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocsSearchDialog({
  open,
  onOpenChange,
}: DocsSearchDialogProps) {
  React.useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
        return;
      }
      event.preventDefault();
      onOpenChange(true);
    };

    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b p-5 pr-12">
          <DialogTitle>Search documentation</DialogTitle>
          <DialogDescription>
            Find a ZeroDrive guide by task, feature, or problem.
          </DialogDescription>
        </DialogHeader>
        <div className="p-5">
          <DocsSearch
            autoFocus
            resultsMode="inline"
            onNavigate={() => onOpenChange(false)}
          />
        </div>
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          Search runs locally in this browser.
        </p>
      </DialogContent>
    </Dialog>
  );
}
