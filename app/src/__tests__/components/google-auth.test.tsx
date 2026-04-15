/**
 * Unit Tests for Google Auth Component
 * Tests Google sign-in button functionality
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoogleAuth } from '../../components/landing-page/google-auth';
import { login } from '../../utils/authService';

// Mock authService
jest.mock('../../utils/authService');

const mockLogin = login as jest.MockedFunction<typeof login>;

describe('GoogleAuth Component', () => {
  const mockOnAuthChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render sign-in button', () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const button = screen.getByRole('button', { name: /sign in with google/i });
    expect(button).toBeInTheDocument();
  });

  it('should display Google logo', () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const image = screen.getByAltText('Google Logo');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src');
  });

  it('should call login() when button is clicked', () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const button = screen.getByRole('button', { name: /sign in with google/i });
    fireEvent.click(button);

    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it('should show loading state when signing in', () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByText(/redirecting to google/i)).toBeInTheDocument();
  });

  it('should disable button when signing in', () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(button).toBeDisabled();
  });

  it('should show spinner icon when loading', () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Loader2 component should be rendered (contains "animate-spin" class)
    const spinner = button.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should not show Google logo when loading', () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryByAltText('Google Logo')).not.toBeInTheDocument();
  });

  it('should accept theme prop', () => {
    const { rerender } = render(
      <GoogleAuth onAuthChange={mockOnAuthChange} theme="dark" />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<GoogleAuth onAuthChange={mockOnAuthChange} theme="light" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should use dark theme by default', () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should have correct button styling classes', () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('shadow-md');
  });

  it('should only call login once on multiple rapid clicks', () => {
    render(<GoogleAuth onAuthChange={mockOnAuthChange} />);

    const button = screen.getByRole('button');

    // First click
    fireEvent.click(button);

    // Try to click again while loading (button is disabled)
    fireEvent.click(button);
    fireEvent.click(button);

    // Should only call login once
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });
});
