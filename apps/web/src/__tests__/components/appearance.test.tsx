import React, { useEffect, useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, Root } from "react-dom/client";
import { readFileSync } from "fs";
import { resolve } from "path";
import { runInNewContext } from "vm";
import { ThemeProvider, useTheme } from "../../components/theme-provider";
import { ModeToggle } from "../../components/mode-toggle";
import {
  INTERFACE_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "../../appearance/preferences";

const appearanceBootstrap = readFileSync(
  resolve(__dirname, "../../../public/appearance.js"),
  "utf8",
);

function runAppearanceBootstrap() {
  runInNewContext(appearanceBootstrap, { document, window, localStorage });
}

function AppearanceConsumer() {
  const { theme, resolvedTheme, interfaceStyle, setTheme, setInterfaceStyle } =
    useTheme();
  return (
    <>
      <output aria-label="Current appearance">
        {interfaceStyle}/{theme}/{resolvedTheme}
      </output>
      <button onClick={() => setInterfaceStyle("modern")}>Use Modern</button>
      <button onClick={() => setInterfaceStyle("creator")}>Use Creator</button>
      <button onClick={() => setTheme("dark")}>Use Dark</button>
      <button onClick={() => setTheme("system")}>Use System</button>
    </>
  );
}

describe("Appearance preferences", () => {
  let media: MediaQueryList;
  let mediaListeners: Set<() => void>;

  beforeEach(() => {
    mediaListeners = new Set();
    media = {
      matches: false,
      media: "(prefers-color-scheme: dark)",
      addEventListener: jest.fn((_, listener) => mediaListeners.add(listener)),
      removeEventListener: jest.fn((_, listener) =>
        mediaListeners.delete(listener),
      ),
    } as unknown as MediaQueryList;
    jest.spyOn(window, "matchMedia").mockReturnValue(media);
    document.documentElement.className = "";
    delete document.documentElement.dataset.interface;
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    document.documentElement.className = "";
    delete document.documentElement.dataset.interface;
    document.documentElement.style.removeProperty("color-scheme");
  });

  const renderAppearance = () =>
    render(
      <ThemeProvider defaultTheme="light">
        <AppearanceConsumer />
      </ThemeProvider>,
    );

  const changeSystemColor = (dark: boolean) => {
    act(() => {
      Object.defineProperty(media, "matches", {
        value: dark,
        configurable: true,
      });
      mediaListeners.forEach((listener) => listener());
    });
  };

  it("should use Creator and the supplied light default without saved preferences", () => {
    renderAppearance();

    expect(screen.getByLabelText("Current appearance")).toHaveTextContent(
      "creator/light/light",
    );
    expect(document.documentElement).toHaveAttribute(
      "data-interface",
      "creator",
    );
    expect(document.documentElement).toHaveClass("light");
  });

  it("should restore existing color and independently saved interface preferences", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    localStorage.setItem(INTERFACE_STORAGE_KEY, "modern");
    renderAppearance();

    expect(screen.getByLabelText("Current appearance")).toHaveTextContent(
      "modern/dark/dark",
    );
    expect(document.documentElement).toHaveAttribute(
      "data-interface",
      "modern",
    );
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("should fall back safely when saved preferences are invalid", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "invalid-color");
    localStorage.setItem(INTERFACE_STORAGE_KEY, "invalid-interface");
    renderAppearance();

    expect(screen.getByLabelText("Current appearance")).toHaveTextContent(
      "creator/light/light",
    );
  });

  it("should keep color mode unchanged when switching interface styles", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    renderAppearance();
    fireEvent.click(screen.getByRole("button", { name: "Use Modern" }));

    expect(localStorage.getItem(INTERFACE_STORAGE_KEY)).toBe("modern");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByLabelText("Current appearance")).toHaveTextContent(
      "modern/dark/dark",
    );
  });

  it("should persist color changes without changing the interface or unrelated root classes", () => {
    localStorage.setItem(INTERFACE_STORAGE_KEY, "modern");
    document.documentElement.classList.add("custom-root-class");
    renderAppearance();
    fireEvent.click(screen.getByRole("button", { name: "Use Dark" }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(localStorage.getItem(INTERFACE_STORAGE_KEY)).toBe("modern");
    expect(document.documentElement).toHaveClass("dark", "custom-root-class");
    expect(document.documentElement).not.toHaveClass("light");
  });

  it("should follow operating system changes only while System mode is selected", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "system");
    renderAppearance();
    changeSystemColor(true);
    expect(screen.getByLabelText("Current appearance")).toHaveTextContent(
      "creator/system/dark",
    );

    changeSystemColor(false);
    expect(document.documentElement).toHaveClass("light");
    fireEvent.click(screen.getByRole("button", { name: "Use Dark" }));
    changeSystemColor(true);
    changeSystemColor(false);
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("should unsubscribe from operating system changes on unmount", () => {
    const { unmount } = renderAppearance();
    expect(mediaListeners.size).toBe(1);
    unmount();
    expect(mediaListeners.size).toBe(0);
  });

  it("should allow session-only changes when local storage access fails", () => {
    jest.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    jest.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    renderAppearance();
    fireEvent.click(screen.getByRole("button", { name: "Use Modern" }));
    fireEvent.click(screen.getByRole("button", { name: "Use Dark" }));

    expect(screen.getByLabelText("Current appearance")).toHaveTextContent(
      "modern/dark/dark",
    );
  });

  it("should preserve child state and selected files without remounting on style changes", () => {
    const onMount = jest.fn();
    const onUnmount = jest.fn();
    function StatefulForm() {
      const [recipient, setRecipient] = useState("");
      useEffect(() => {
        onMount();
        return onUnmount;
      }, []);
      return (
        <>
          <input
            aria-label="Recipient"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
          />
          <input aria-label="Selected file" type="file" />
        </>
      );
    }
    render(
      <ThemeProvider defaultTheme="light">
        <AppearanceConsumer />
        <StatefulForm />
      </ThemeProvider>,
    );
    fireEvent.change(screen.getByLabelText("Recipient"), {
      target: { value: "recipient@example.com" },
    });
    const fileInput = screen.getByLabelText(
      "Selected file",
    ) as HTMLInputElement;
    const file = new File(["example"], "example.txt");
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Use Modern" }));
    fireEvent.click(screen.getByRole("button", { name: "Use Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Use Creator" }));

    expect(screen.getByLabelText("Recipient")).toHaveValue(
      "recipient@example.com",
    );
    expect(screen.getByLabelText("Selected file")).toBe(fileInput);
    expect(fileInput.files?.[0]).toBe(file);
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();
  });

  it("should render canonical Creator markup on the server even with saved Modern preferences", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    localStorage.setItem(INTERFACE_STORAGE_KEY, "modern");
    const view = renderToString(
      <ThemeProvider defaultTheme="light">
        <AppearanceConsumer />
      </ThemeProvider>,
    );

    expect(view).toContain("creator");
    expect(view).toContain("light");
    expect(view).not.toContain("modern");
    expect(view).not.toContain("dark");
  });

  it("should hydrate canonical markup for a returning Modern user without replacing child state or recovering errors", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    localStorage.setItem(INTERFACE_STORAGE_KEY, "modern");
    const onRecoverableError = jest.fn();
    const onMount = jest.fn();
    const onUnmount = jest.fn();
    function HydratedForm() {
      useEffect(() => {
        onMount();
        return onUnmount;
      }, []);
      return <input aria-label="Hydrated draft" defaultValue="Saved draft" />;
    }
    const application = (
      <ThemeProvider defaultTheme="light">
        <AppearanceConsumer />
        <HydratedForm />
      </ThemeProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(application);
    document.body.appendChild(container);
    const originalInput = screen.getByLabelText("Hydrated draft");
    expect(screen.getByLabelText("Current appearance")).toHaveTextContent(
      "creator/light/light",
    );
    runAppearanceBootstrap();
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, application, { onRecoverableError });
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Current appearance")).toHaveTextContent(
        "modern/dark/dark",
      );
      expect(document.documentElement).toHaveAttribute(
        "data-interface",
        "modern",
      );
      expect(document.documentElement).toHaveClass("dark");
      expect(screen.getByLabelText("Hydrated draft")).toBe(originalInput);
      expect(originalInput).toHaveValue("Saved draft");
      expect(onMount).toHaveBeenCalledTimes(1);
      expect(onUnmount).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });

  it("should initialize valid saved preferences before application hydration", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    localStorage.setItem(INTERFACE_STORAGE_KEY, "modern");
    runAppearanceBootstrap();

    expect(document.documentElement).toHaveAttribute(
      "data-interface",
      "modern",
    );
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("should initialize Creator light appearance when bootstrap preferences are invalid", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "invalid");
    localStorage.setItem(INTERFACE_STORAGE_KEY, "invalid");
    runAppearanceBootstrap();

    expect(document.documentElement).toHaveAttribute(
      "data-interface",
      "creator",
    );
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("should initialize Creator light appearance when bootstrap storage is unavailable", () => {
    jest.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    expect(runAppearanceBootstrap).not.toThrow();

    expect(document.documentElement).toHaveAttribute(
      "data-interface",
      "creator",
    );
    expect(document.documentElement).toHaveClass("light");
  });

  it.each([true, false])(
    "should resolve System appearance during bootstrap when system dark is %s",
    (dark) => {
      localStorage.setItem(THEME_STORAGE_KEY, "system");
      Object.defineProperty(media, "matches", {
        value: dark,
        configurable: true,
      });
      runAppearanceBootstrap();

      expect(document.documentElement).toHaveClass(dark ? "dark" : "light");
      expect(document.documentElement.style.colorScheme).toBe(
        dark ? "dark" : "light",
      );
    },
  );

  it("should expose separate checked interface and color choices through the appearance menu", async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ModeToggle />
        <AppearanceConsumer />
      </ThemeProvider>,
    );
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Appearance settings" }),
      { key: "ArrowDown" },
    );
    expect(
      await screen.findByRole("menuitemradio", { name: "Creator’s choice" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemradio", { name: "Light" }),
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Modern" }));
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Appearance settings" }),
      { key: "ArrowDown" },
    );
    expect(
      await screen.findByRole("menuitemradio", { name: "Modern" }),
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "System" }));

    expect(localStorage.getItem(INTERFACE_STORAGE_KEY)).toBe("modern");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(screen.getByLabelText("Current appearance")).toHaveTextContent(
      "modern/system/light",
    );
  });
});
