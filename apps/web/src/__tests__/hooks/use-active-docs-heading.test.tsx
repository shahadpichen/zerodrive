import React from "react";
import { act, render, screen } from "@testing-library/react";
import { useActiveDocsHeading } from "../../hooks/use-active-docs-heading";

const sectionIds = ["first", "second", "third"];

type ObserverCallback = ConstructorParameters<typeof IntersectionObserver>[0];

class TestIntersectionObserver {
  static instance: TestIntersectionObserver | null = null;

  readonly root = null;
  readonly rootMargin = "-32px 0px 0px 0px";
  readonly thresholds = [0];
  private readonly callback: ObserverCallback;

  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn(() => []);

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    TestIntersectionObserver.instance = this;
  }

  trigger() {
    this.callback([], this as unknown as IntersectionObserver);
  }
}

function Harness({ enabled }: { enabled: boolean }) {
  const { activeSection, registerHeading, registerArticleEnd } =
    useActiveDocsHeading(sectionIds, enabled);

  return (
    <>
      <output aria-label="Active section">{activeSection}</output>
      {sectionIds.map((id) => (
        <h2 key={id} id={id} ref={(element) => registerHeading(id, element)}>
          {id}
        </h2>
      ))}
      <span id="article-end" ref={registerArticleEnd} />
    </>
  );
}

describe("useActiveDocsHeading", () => {
  const sectionTop = new Map<string, number>();
  const OriginalIntersectionObserver = global.IntersectionObserver;

  beforeEach(() => {
    sectionTop.set("first", -200);
    sectionTop.set("second", 60);
    sectionTop.set("third", 600);
    sectionTop.set("article-end", 1_200);
    TestIntersectionObserver.instance = null;
    global.IntersectionObserver =
      TestIntersectionObserver as unknown as typeof IntersectionObserver;

    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function getBoundingClientRect(this: HTMLElement) {
        const top = sectionTop.get(this.id) ?? 0;
        return {
          top,
          bottom: top + 40,
          left: 0,
          right: 100,
          width: 100,
          height: 40,
          x: 0,
          y: top,
          toJSON: () => ({}),
        };
      });
  });

  afterEach(() => {
    global.IntersectionObserver = OriginalIntersectionObserver;
    jest.restoreAllMocks();
  });

  it("tracks live headings in both scroll directions", () => {
    render(<Harness enabled />);
    const observer = TestIntersectionObserver.instance;

    expect(observer).not.toBeNull();
    expect(observer?.observe).toHaveBeenCalledTimes(4);
    expect(screen.getByLabelText("Active section")).toHaveTextContent("first");

    sectionTop.set("second", 24);
    act(() => observer?.trigger());
    expect(screen.getByLabelText("Active section")).toHaveTextContent("second");

    sectionTop.set("second", -120);
    sectionTop.set("third", 24);
    act(() => observer?.trigger());
    expect(screen.getByLabelText("Active section")).toHaveTextContent("third");

    sectionTop.set("second", 24);
    sectionTop.set("third", 600);
    act(() => observer?.trigger());
    expect(screen.getByLabelText("Active section")).toHaveTextContent("second");

    sectionTop.set("first", 24);
    sectionTop.set("second", 600);
    act(() => observer?.trigger());
    expect(screen.getByLabelText("Active section")).toHaveTextContent("first");
  });

  it("activates a short final section when the article end becomes visible", () => {
    render(<Harness enabled />);
    const observer = TestIntersectionObserver.instance;

    sectionTop.set("third", 180);
    sectionTop.set("article-end", window.innerHeight - 1);

    act(() => observer?.trigger());

    expect(screen.getByLabelText("Active section")).toHaveTextContent("third");
  });
});
