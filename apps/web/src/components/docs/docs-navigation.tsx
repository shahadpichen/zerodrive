import React from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  docsCategories,
  getPagesInCategory,
  type DocsPage,
} from "./docs-content";
import { cn } from "../../lib/utils";

interface DocsNavigationProps {
  currentPage?: DocsPage;
  onNavigate?: () => void;
  compact?: boolean;
}

export function DocsNavigation({
  currentPage,
  onNavigate,
  compact = false,
}: DocsNavigationProps) {
  const navigationId = React.useId();
  const [openCategories, setOpenCategories] = React.useState<
    Record<string, boolean>
  >(() => {
    const initiallyOpen = currentPage?.category || docsCategories[0]?.id;
    return initiallyOpen ? { [initiallyOpen]: true } : {};
  });

  React.useEffect(() => {
    if (!currentPage?.category) return;
    setOpenCategories((current) => ({
      ...current,
      [currentPage.category]: true,
    }));
  }, [currentPage?.category]);

  const toggleCategory = (categoryId: string) => {
    setOpenCategories((current) => ({
      ...current,
      [categoryId]: !current[categoryId],
    }));
  };

  return (
    <nav aria-label="Documentation">
      <Link
        to="/docs"
        onClick={onNavigate}
        className={cn(
          "mb-6 block text-sm font-semibold underline-offset-4 hover:underline",
          !currentPage && "text-link",
        )}
      >
        Documentation home
      </Link>

      <div className={cn("space-y-7", compact && "space-y-5")}>
        {docsCategories.map((category) => {
          const isOpen = Boolean(openCategories[category.id]);
          const contentId = `${navigationId}-category-${category.id}`;
          return (
            <section key={category.id}>
              <h2>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => toggleCategory(category.id)}
                  className="group flex w-full items-center justify-between gap-3 py-1 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span>{category.title}</span>
                  <ChevronRight
                    aria-hidden="true"
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform",
                      isOpen && "rotate-90",
                    )}
                  />
                </button>
              </h2>
              <ul
                id={contentId}
                hidden={!isOpen}
                className="mt-3 space-y-1"
              >
                {getPagesInCategory(category.id).map((page) => {
                  const isCurrent = page.slug === currentPage?.slug;
                  return (
                    <li key={page.slug}>
                      <Link
                        to={`/docs/${page.slug}`}
                        onClick={onNavigate}
                        aria-current={isCurrent ? "page" : undefined}
                        className={cn(
                          "block border-l-2 py-1.5 pl-3 text-sm leading-5 transition-colors",
                          isCurrent
                            ? "border-foreground font-semibold text-foreground"
                            : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        {page.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </nav>
  );
}
