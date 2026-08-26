import React from "react";

export type RegisterDocsHeading = (
  id: string,
  element: HTMLHeadingElement | null,
) => void;
export type RegisterDocsEnd = (element: HTMLElement | null) => void;

export function useActiveDocsHeading(
  sectionIds: readonly string[],
  enabled = true,
) {
  const [activeSection, setActiveSection] = React.useState(sectionIds[0] || "");
  const headingElements = React.useRef(new Map<string, HTMLHeadingElement>());
  const articleEndElement = React.useRef<HTMLElement | null>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  const updateActiveSection = React.useCallback(() => {
    const headingAnchorOffset = 32;
    let currentSection = sectionIds[0] || "";

    const endElement = articleEndElement.current;
    if (
      endElement?.isConnected &&
      endElement.getBoundingClientRect().top <= window.innerHeight
    ) {
      setActiveSection(sectionIds[sectionIds.length - 1] || "");
      return;
    }

    for (const id of sectionIds) {
      const element = headingElements.current.get(id);
      if (!element || !element.isConnected) continue;
      if (element.getBoundingClientRect().top > headingAnchorOffset) break;
      currentSection = id;
    }

    setActiveSection(currentSection);
  }, [sectionIds]);

  const registerHeading = React.useCallback<RegisterDocsHeading>(
    (id, element) => {
      const previousElement = headingElements.current.get(id);
      if (previousElement === element) return;

      if (previousElement) observerRef.current?.unobserve(previousElement);

      if (element) {
        headingElements.current.set(id, element);
        observerRef.current?.observe(element);
      } else {
        headingElements.current.delete(id);
      }
    },
    [],
  );

  const registerArticleEnd = React.useCallback<RegisterDocsEnd>((element) => {
    const previousElement = articleEndElement.current;
    if (previousElement === element) return;

    if (previousElement) observerRef.current?.unobserve(previousElement);
    articleEndElement.current = element;
    if (element) observerRef.current?.observe(element);
  }, []);

  React.useEffect(() => {
    setActiveSection(sectionIds[0] || "");
    if (!enabled) return;

    if (typeof IntersectionObserver === "undefined") {
      updateActiveSection();
      window.addEventListener("scroll", updateActiveSection, { passive: true });
      return () => window.removeEventListener("scroll", updateActiveSection);
    }

    const observer = new IntersectionObserver(updateActiveSection, {
      root: null,
      rootMargin: "-32px 0px 0px 0px",
      threshold: 0,
    });
    observerRef.current = observer;
    headingElements.current.forEach((element) => observer.observe(element));
    if (articleEndElement.current) observer.observe(articleEndElement.current);
    updateActiveSection();

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [enabled, sectionIds, updateActiveSection]);

  return { activeSection, registerHeading, registerArticleEnd };
}
