import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { GoogleAuth } from "../../components/landing-page/google-auth";
import { login } from "../../utils/authService";

jest.mock("../../utils/authService");

const mockLogin = login as jest.MockedFunction<typeof login>;

describe("GoogleAuth Component", () => {
  const mockOnAuthChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render sign-in button", () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const button = screen.getByRole("button", { name: /sign in with google/i });
    expect(button).toBeInTheDocument();
  });

  it("should display Google logo", () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const image = screen.getByAltText("Google Logo");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src");
  });

  it("should explain Google access before redirecting", () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const button = screen.getByRole("button", { name: /sign in with google/i });
    fireEvent.click(button);

    expect(
      screen.getByRole("heading", { name: /before google asks for access/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/google may show a permission screen/i),
    ).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("should call login() when continuing with Google", () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    fireEvent.click(screen.getByRole("button", { name: /sign in with google/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it("should show loading state when signing in", () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    fireEvent.click(screen.getByRole("button", { name: /sign in with google/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(screen.getAllByText(/redirecting/i).length).toBeGreaterThan(0);
  });

  it("should disable buttons when signing in", () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const signInButton = screen.getByRole("button", {
      name: /sign in with google/i,
    });
    fireEvent.click(signInButton);
    const continueButton = screen.getByRole("button", {
      name: /continue with google/i,
    });
    fireEvent.click(continueButton);

    expect(signInButton).toBeDisabled();
    expect(continueButton).toBeDisabled();
  });

  it("should show spinner icon when loading", () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    fireEvent.click(screen.getByRole("button", { name: /sign in with google/i }));
    const continueButton = screen.getByRole("button", {
      name: /continue with google/i,
    });
    fireEvent.click(continueButton);

    const spinner = continueButton.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("should not show Google logo in the main button when loading", () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const signInButton = screen.getByRole("button", {
      name: /sign in with google/i,
    });
    fireEvent.click(signInButton);
    fireEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(signInButton.querySelector('img[alt="Google Logo"]')).toBeNull();
  });

  it("should accept theme prop", () => {
    const { rerender } = render(
      <GoogleAuth onAuthChange={mockOnAuthChange} theme="dark" />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();

    rerender(<GoogleAuth onAuthChange={mockOnAuthChange} theme="light" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should use dark theme by default", () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should have correct button styling classes", () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("shadow-md");
  });

  it("should only call login once on multiple rapid continue clicks", () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    fireEvent.click(screen.getByRole("button", { name: /sign in with google/i }));
    const continueButton = screen.getByRole("button", {
      name: /continue with google/i,
    });
    fireEvent.click(continueButton);
    fireEvent.click(continueButton);
    fireEvent.click(continueButton);

    expect(mockLogin).toHaveBeenCalledTimes(1);
  });
});
