import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppSidebar } from "../../components/layout/app-sidebar";
import { useApp } from "../../contexts/app-context";
import { useSidebar } from "../../contexts/sidebar-context";
import { getStoredKey } from "../../utils/cryptoUtils";

jest.mock("../../contexts/app-context");
jest.mock("../../contexts/sidebar-context");
jest.mock("../../utils/cryptoUtils", () => ({
  getStoredKey: jest.fn(),
}));
jest.mock("../../components/mode-toggle", () => ({
  ModeToggle: () => <button aria-label="Toggle theme">Toggle theme</button>,
}));

const mockUseApp = useApp as jest.MockedFunction<typeof useApp>;
const mockUseSidebar = useSidebar as jest.MockedFunction<typeof useSidebar>;
const mockGetStoredKey = getStoredKey as jest.MockedFunction<
  typeof getStoredKey
>;

function renderSidebar() {
  return render(
    <MemoryRouter>
      <AppSidebar />
    </MemoryRouter>,
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSidebar.mockReturnValue({
      isOpen: true,
      isMobile: false,
      toggle: jest.fn(),
      open: jest.fn(),
      close: jest.fn(),
    });
    mockUseApp.mockReturnValue({
      userEmail: "user@example.com",
      userName: "Zero User",
      userImage: "",
      storageInfo: { used: 1024, total: 1024 * 1024 },
      isLoadingStorage: false,
      hasDecryptionError: false,
      setDecryptionError: jest.fn(),
      refreshStorage: jest.fn(),
      refreshAll: jest.fn(),
      setUserInfo: jest.fn(),
    });
  });

  it("uses the guided authenticated navigation labels", async () => {
    mockGetStoredKey.mockResolvedValue({} as CryptoKey);

    renderSidebar();

    expect(screen.getByRole("link", { name: /storage/i })).toHaveAttribute(
      "href",
      "/storage",
    );
    expect(
      screen.getByRole("link", { name: /share files/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /shared with me/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /recovery & access/i }),
    ).toHaveAttribute("href", "/key-management");
    expect(
      screen.getByRole("button", { name: /create sharing identity/i }),
    ).toBeInTheDocument();
  });

  it("shows whether this browser currently has vault access", async () => {
    mockGetStoredKey.mockResolvedValue({} as CryptoKey);

    renderSidebar();

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveAccessibleName(
        "Vault key active",
      );
    });
    expect(
      screen.getByText(/this browser can encrypt and decrypt/i),
    ).toBeInTheDocument();
  });

  it("shows a recovery-needed status when no vault key is available", async () => {
    mockGetStoredKey.mockResolvedValue(null);

    renderSidebar();

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveAccessibleName(
        "Vault access needed",
      );
    });
    expect(
      screen.getByText(/recover access before opening files/i),
    ).toBeInTheDocument();
  });
});
