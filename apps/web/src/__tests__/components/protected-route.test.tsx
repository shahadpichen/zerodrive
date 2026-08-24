/**
 * Unit Tests for Protected Route Component
 * Tests authentication-based route protection
 */

import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  BrowserRouter,
  MemoryRouter,
  Routes,
  Route,
  useNavigate,
  type NavigateFunction,
} from "react-router-dom";
import ProtectedRoute from "../../components/protected-route";
import { isAuthenticated } from "../../utils/authService";
import { useRsaKeyRecovery } from "../../hooks/useRsaKeyRecovery";

// Mock authService
jest.mock("../../utils/authService");
jest.mock("../../hooks/useRsaKeyRecovery", () => ({
  useRsaKeyRecovery: jest.fn(),
}));

const mockIsAuthenticated = isAuthenticated as jest.MockedFunction<
  typeof isAuthenticated
>;
const mockUseRsaKeyRecovery = useRsaKeyRecovery as jest.MockedFunction<
  typeof useRsaKeyRecovery
>;
let recoveryEffectMounts = 0;

// Test components
const ProtectedContent = () => <div>Protected Content</div>;
const PublicContent = () => <div>Public Content</div>;

const ProtectedNavigation = () => {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate("/protected/two")}>
      Go to second page
    </button>
  );
};

let navigateProtectedHistory: NavigateFunction;

const ProtectedHistoryPage = ({ label }: { label: string }) => {
  navigateProtectedHistory = useNavigate();
  return <div>{label}</div>;
};

// Helper to render with router
const renderWithRouter = (
  component: React.ReactElement,
  initialRoute = "/",
) => {
  window.history.pushState({}, "Test page", initialRoute);

  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicContent />} />
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <ProtectedContent />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>,
  );
};

describe("ProtectedRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recoveryEffectMounts = 0;
    mockUseRsaKeyRecovery.mockImplementation(() => {
      React.useEffect(() => {
        recoveryEffectMounts += 1;
      }, []);
    });
  });

  it("should render children when user is authenticated", async () => {
    mockIsAuthenticated.mockResolvedValue(true);

    renderWithRouter(<div />, "/protected");

    // Should show loading state initially (null return)
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();

    // Wait for authentication check
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
    expect(recoveryEffectMounts).toBe(1);
  });

  it("should redirect to default path when user is not authenticated", async () => {
    mockIsAuthenticated.mockResolvedValue(false);

    renderWithRouter(<div />, "/protected");

    // Wait for redirect
    await waitFor(() => {
      expect(screen.getByText("Public Content")).toBeInTheDocument();
    });

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(recoveryEffectMounts).toBe(0);
  });

  it("should redirect to custom path when specified", async () => {
    mockIsAuthenticated.mockResolvedValue(false);

    window.history.pushState({}, "Test page", "/protected");

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute redirectPath="/login">
                <ProtectedContent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
  });

  it("should show nothing while checking authentication", () => {
    // Mock long-running auth check
    mockIsAuthenticated.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 1000)),
    );

    renderWithRouter(<div />, "/protected");

    // Should not render anything during loading
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Public Content")).not.toBeInTheDocument();
  });

  it("should call isAuthenticated on mount", async () => {
    mockIsAuthenticated.mockResolvedValue(true);

    renderWithRouter(<div />, "/protected");

    expect(mockIsAuthenticated).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("should handle authentication check errors gracefully", async () => {
    mockIsAuthenticated.mockRejectedValue(new Error("Auth check failed"));

    renderWithRouter(<div />, "/protected");

    // Should redirect to default path on error
    await waitFor(() => {
      expect(screen.getByText("Public Content")).toBeInTheDocument();
    });
  });

  it("should render multiple children when authenticated", async () => {
    mockIsAuthenticated.mockResolvedValue(true);

    window.history.pushState({}, "Test page", "/protected");

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicContent />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Child 1</div>
                <div>Child 2</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>,
    );

    expect(await screen.findByText("Child 1")).toBeInTheDocument();
    expect(screen.getByText("Child 2")).toBeInTheDocument();
  });

  it("keeps authenticated effects mounted across protected route navigation", async () => {
    mockIsAuthenticated.mockResolvedValue(true);
    window.history.pushState({}, "Test page", "/protected/one");

    render(
      <BrowserRouter>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected/one" element={<ProtectedNavigation />} />
            <Route
              path="/protected/two"
              element={<div>Second protected page</div>}
            />
          </Route>
        </Routes>
      </BrowserRouter>,
    );

    expect(
      await screen.findByRole("button", { name: "Go to second page" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go to second page" }));

    expect(
      await screen.findByText("Second protected page"),
    ).toBeInTheDocument();
    expect(mockIsAuthenticated).toHaveBeenCalledTimes(2);
    expect(recoveryEffectMounts).toBe(1);
  });

  it("requires the latest auth check after rapid back and forward navigation", async () => {
    let resolveBackCheck!: (value: boolean) => void;
    let resolveForwardCheck!: (value: boolean) => void;

    mockIsAuthenticated
      .mockResolvedValueOnce(true)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveBackCheck = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveForwardCheck = resolve;
        }),
      );

    render(
      <MemoryRouter
        initialEntries={[
          "/protected/one",
          "/protected/two",
          "/protected/three",
        ]}
        initialIndex={2}
      >
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route
              path="/protected/one"
              element={<ProtectedHistoryPage label="First protected page" />}
            />
            <Route
              path="/protected/two"
              element={<ProtectedHistoryPage label="Second protected page" />}
            />
            <Route
              path="/protected/three"
              element={<ProtectedHistoryPage label="Third protected page" />}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Third protected page")).toBeInTheDocument();

    await act(async () => {
      navigateProtectedHistory(-1);
    });
    await waitFor(() => expect(mockIsAuthenticated).toHaveBeenCalledTimes(2));

    await act(async () => {
      navigateProtectedHistory(1);
    });
    await waitFor(() => expect(mockIsAuthenticated).toHaveBeenCalledTimes(3));

    expect(screen.queryByText("Third protected page")).not.toBeInTheDocument();
    expect(recoveryEffectMounts).toBe(1);

    await act(async () => {
      resolveForwardCheck(true);
    });

    expect(await screen.findByText("Third protected page")).toBeInTheDocument();

    await act(async () => {
      resolveBackCheck(true);
    });
  });
});
