/**
 * Unit Tests for Protected Route Component
 * Tests authentication-based route protection
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../components/protected-route';
import { isAuthenticated } from '../../utils/authService';

// Mock authService
jest.mock('../../utils/authService');

const mockIsAuthenticated = isAuthenticated as jest.MockedFunction<typeof isAuthenticated>;

// Test components
const ProtectedContent = () => <div>Protected Content</div>;
const PublicContent = () => <div>Public Content</div>;

// Helper to render with router
const renderWithRouter = (component: React.ReactElement, initialRoute = '/') => {
  window.history.pushState({}, 'Test page', initialRoute);

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
    </BrowserRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children when user is authenticated', async () => {
    mockIsAuthenticated.mockResolvedValue(true);

    renderWithRouter(<div />, '/protected');

    // Should show loading state initially (null return)
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();

    // Wait for authentication check
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('should redirect to default path when user is not authenticated', async () => {
    mockIsAuthenticated.mockResolvedValue(false);

    renderWithRouter(<div />, '/protected');

    // Wait for redirect
    await waitFor(() => {
      expect(screen.getByText('Public Content')).toBeInTheDocument();
    });

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should redirect to custom path when specified', async () => {
    mockIsAuthenticated.mockResolvedValue(false);

    window.history.pushState({}, 'Test page', '/protected');

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
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('should show nothing while checking authentication', () => {
    // Mock long-running auth check
    mockIsAuthenticated.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 1000))
    );

    renderWithRouter(<div />, '/protected');

    // Should not render anything during loading
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Public Content')).not.toBeInTheDocument();
  });

  it('should call isAuthenticated on mount', async () => {
    mockIsAuthenticated.mockResolvedValue(true);

    renderWithRouter(<div />, '/protected');

    expect(mockIsAuthenticated).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('should handle authentication check errors gracefully', async () => {
    mockIsAuthenticated.mockRejectedValue(new Error('Auth check failed'));

    renderWithRouter(<div />, '/protected');

    // Should redirect to default path on error
    await waitFor(() => {
      expect(screen.getByText('Public Content')).toBeInTheDocument();
    });
  });

  it('should render multiple children when authenticated', async () => {
    mockIsAuthenticated.mockResolvedValue(true);

    window.history.pushState({}, 'Test page', '/protected');

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
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
    });
  });
});
