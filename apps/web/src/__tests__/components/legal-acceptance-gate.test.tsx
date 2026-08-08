import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  LegalAcceptanceGate,
  LegalAcceptanceProvider,
} from "../../components/legal-acceptance-gate";
import apiClient from "../../utils/apiClient";

jest.mock("../../utils/apiClient", () => ({
  __esModule: true,
  default: {
    legalAcceptance: {
      getStatus: jest.fn(),
      accept: jest.fn(),
    },
  },
}));

const mockGetStatus = apiClient.legalAcceptance
  .getStatus as jest.MockedFunction<typeof apiClient.legalAcceptance.getStatus>;
const mockAccept = apiClient.legalAcceptance.accept as jest.MockedFunction<
  typeof apiClient.legalAcceptance.accept
>;

function status(accepted: boolean) {
  return {
    accepted,
    required: true,
    termsVersion: "2026-08",
    privacyVersion: "2026-08",
    acceptedAt: accepted ? "2026-08-08T00:00:00.000Z" : null,
  };
}

function renderGate(requireAcceptance = true) {
  return render(
    <MemoryRouter>
      <LegalAcceptanceProvider>
        <LegalAcceptanceGate requireAcceptance={requireAcceptance}>
          <div>Protected content</div>
        </LegalAcceptanceGate>
      </LegalAcceptanceProvider>
    </MemoryRouter>,
  );
}

describe("LegalAcceptanceGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders protected content when current legal documents are accepted", async () => {
    mockGetStatus.mockResolvedValue(status(true));

    renderGate();

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(screen.queryByText(/review terms and privacy first/i)).toBeNull();
  });

  it("blocks protected content and opens the review dialog when not accepted", async () => {
    mockGetStatus.mockResolvedValue(status(false));

    renderGate();

    expect(
      await screen.findByText(/review terms and privacy first/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).toBeNull();
    expect(
      screen.getByRole("heading", { name: /review terms and privacy/i }),
    ).toBeInTheDocument();
  });

  it("records acceptance and unlocks protected content", async () => {
    mockGetStatus.mockResolvedValue(status(false));
    mockAccept.mockResolvedValue(status(true));

    renderGate();

    expect(
      await screen.findByText(/review terms and privacy first/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /i agree to the terms of service/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /accept and continue/i }));

    await waitFor(() => expect(mockAccept).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  });

  it("can prompt without blocking Home content", async () => {
    mockGetStatus.mockResolvedValue(status(false));

    renderGate(false);

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: /review terms and privacy/i,
      }),
    ).toBeInTheDocument();
  });
});
