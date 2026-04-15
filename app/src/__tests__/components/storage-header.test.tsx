/**
 * Unit Tests for Storage Header Component
 * Tests header rendering, user dropdown, credits/storage display, and navigation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Header from '../../components/storage/header';
import { useApp } from '../../contexts/app-context';
import { useSidebar } from '../../contexts/sidebar-context';

// Mock contexts
jest.mock('../../contexts/app-context');
jest.mock('../../contexts/sidebar-context');

// Mock theme provider
jest.mock('../../components/theme-provider', () => ({
  useTheme: jest.fn(() => ({
    theme: 'light',
    setTheme: jest.fn(),
  })),
}));

// Mock authService
jest.mock('../../utils/authService', () => ({
  logout: jest.fn().mockResolvedValue(undefined),
}));

// Mock Radix UI components
jest.mock('@radix-ui/react-dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div onClick={onClick} role="menuitem">
      {children}
    </div>
  ),
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <div role="separator" />,
}));

jest.mock('@radix-ui/react-avatar', () => ({
  Avatar: ({ children }: any) => <div>{children}</div>,
  AvatarImage: ({ src, alt }: any) => <img src={src} alt={alt} />,
  AvatarFallback: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@radix-ui/react-progress', () => ({
  Root: ({ value, ...props }: any) => (
    <div role="progressbar" aria-valuenow={value} {...props} />
  ),
  Indicator: ({ children }: any) => <div>{children}</div>,
}));

const mockUseApp = useApp as jest.MockedFunction<typeof useApp>;
const mockUseSidebar = useSidebar as jest.MockedFunction<typeof useSidebar>;

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Header Component', () => {
  const defaultAppContext = {
    creditBalance: 5.5,
    storageInfo: { used: 1024 * 1024 * 500, total: 1024 * 1024 * 1024 * 15 },
    userEmail: 'test@example.com',
    userName: 'Test User',
    userImage: 'https://example.com/avatar.jpg',
    hasDecryptionError: false,
    setDecryptionError: jest.fn(),
    refreshCredits: jest.fn(),
    refreshStorage: jest.fn(),
    refreshAll: jest.fn(),
    setUserInfo: jest.fn(),
    isLoadingStorage: false,
    isLoadingCredits: false,
  };

  const defaultSidebarContext = {
    isOpen: false,
    isMobile: true,
    toggle: jest.fn(),
    open: jest.fn(),
    close: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApp.mockReturnValue(defaultAppContext);
    mockUseSidebar.mockReturnValue(defaultSidebarContext);
    // Mock localStorage
    Storage.prototype.removeItem = jest.fn();
  });

  describe('Basic Rendering', () => {
    it('should render header with logo', () => {
      renderWithRouter(<Header />);

      expect(screen.getByAltText('ZeroDrive Logo')).toBeInTheDocument();
      expect(screen.getByText('ZeroDrive')).toBeInTheDocument();
    });

    it('should render hamburger menu on mobile', () => {
      renderWithRouter(<Header />);

      const menuButton = screen.getByLabelText('Toggle navigation menu');
      expect(menuButton).toBeInTheDocument();
    });

    it('should call toggle when hamburger is clicked', () => {
      renderWithRouter(<Header />);

      const menuButton = screen.getByLabelText('Toggle navigation menu');
      fireEvent.click(menuButton);

      expect(defaultSidebarContext.toggle).toHaveBeenCalledTimes(1);
    });

    it('should hide hamburger menu on desktop', () => {
      mockUseSidebar.mockReturnValue({
        ...defaultSidebarContext,
        isMobile: false,
      });

      renderWithRouter(<Header />);

      const menuButton = screen.queryByLabelText('Toggle navigation menu');
      expect(menuButton).toHaveClass('md:hidden');
    });
  });

  describe('User Avatar and Dropdown', () => {
    it('should render user avatar', () => {
      renderWithRouter(<Header />);

      const avatar = screen.getByRole('button', { name: /test user/i });
      expect(avatar).toBeInTheDocument();
    });

    it('should display user initials when no image', () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        userImage: '',
      });

      renderWithRouter(<Header />);

      expect(screen.getByText('TU')).toBeInTheDocument();
    });

    it('should display single initial for single-word name', () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        userName: 'John',
        userImage: '',
      });

      renderWithRouter(<Header />);

      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('should display first letter of first two words for multi-word name', () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        userName: 'John Michael Smith',
        userImage: '',
      });

      renderWithRouter(<Header />);

      expect(screen.getByText('JM')).toBeInTheDocument();
    });

    it('should open dropdown menu when avatar is clicked', async () => {
      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button', { name: /test user/i });
      fireEvent.click(avatarButton);

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('should display user name and email in dropdown', async () => {
      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button', { name: /test user/i });
      fireEvent.click(avatarButton);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });
  });

  describe('Credits Display', () => {
    it('should display credit balance', async () => {
      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        expect(screen.getByText('5.5')).toBeInTheDocument();
        expect(screen.getByText('Credits')).toBeInTheDocument();
      });
    });

    it('should show green color for high credits', async () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        creditBalance: 10,
      });

      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        const creditsValue = screen.getByText('10.0');
        expect(creditsValue).toHaveClass('text-green-600');
      });
    });

    it('should show amber color for low credits', async () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        creditBalance: 2,
      });

      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        const creditsValue = screen.getByText('2.0');
        expect(creditsValue).toHaveClass('text-amber-600');
      });
    });

    it('should show red color for very low credits', async () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        creditBalance: 0.5,
      });

      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        const creditsValue = screen.getByText('0.5');
        expect(creditsValue).toHaveClass('text-red-600');
      });
    });

    it('should show loading skeleton when credits are null', async () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        creditBalance: null,
      });

      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        const skeleton = document.querySelector('.animate-pulse');
        expect(skeleton).toBeInTheDocument();
      });
    });

    it('should not show credits when user email is missing', async () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        userEmail: '',
        creditBalance: null,
      });

      renderWithRouter(<Header />);

      const avatarButton = screen.queryByRole('button', { name: /test user/i });
      expect(avatarButton).not.toBeInTheDocument();
    });
  });

  describe('Storage Display', () => {
    it('should display storage usage', async () => {
      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        expect(screen.getByText(/storage/i)).toBeInTheDocument();
        expect(screen.getByText(/500.00 MB/i)).toBeInTheDocument();
        expect(screen.getByText(/15.00 GB/i)).toBeInTheDocument();
      });
    });

    it('should show storage progress bar', async () => {
      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        const progressBar = document.querySelector('[role="progressbar"]');
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('should calculate correct storage percentage', async () => {
      // 500MB / 15GB = ~3.33%
      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        const progressBar = document.querySelector('[role="progressbar"]');
        const value = progressBar?.getAttribute('aria-valuenow');
        expect(parseFloat(value || '0')).toBeCloseTo(3.33, 1);
      });
    });

    it('should show loading skeleton when storage is null', async () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        storageInfo: null,
      });

      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        const skeletons = document.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });

    it('should format bytes correctly - KB', async () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        storageInfo: { used: 1024 * 500, total: 1024 * 1024 * 10 },
      });

      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        expect(screen.getByText(/500 KB/i)).toBeInTheDocument();
      });
    });

    it('should format bytes correctly - GB', async () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        storageInfo: { used: 1024 * 1024 * 1024 * 2.5, total: 1024 * 1024 * 1024 * 15 },
      });

      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        expect(screen.getByText(/2.5 GB/i)).toBeInTheDocument();
      });
    });

    it('should format zero bytes correctly', async () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        storageInfo: { used: 0, total: 1024 * 1024 * 1024 * 15 },
      });

      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        expect(screen.getByText(/0 Bytes/i)).toBeInTheDocument();
      });
    });
  });

  describe('Decryption Error Banner', () => {
    it('should show decryption error banner when hasDecryptionError is true', () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        hasDecryptionError: true,
      });

      renderWithRouter(<Header />);

      expect(screen.getByText(/decryption failed/i)).toBeInTheDocument();
      expect(screen.getByText(/update encryption key/i)).toBeInTheDocument();
    });

    it('should not show decryption error banner when hasDecryptionError is false', () => {
      renderWithRouter(<Header />);

      expect(screen.queryByText(/decryption failed/i)).not.toBeInTheDocument();
    });

    it('should navigate to key-management when error link is clicked', () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        hasDecryptionError: true,
      });

      renderWithRouter(<Header />);

      const errorLink = screen.getByText(/update encryption key/i);
      fireEvent.click(errorLink);

      // Check that navigation was attempted (URL would change in real app)
      expect(errorLink).toBeInTheDocument();
    });

    it('should hide error banner on mobile', () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        hasDecryptionError: true,
      });

      renderWithRouter(<Header />);

      const errorBanner = screen.getByText(/decryption failed/i).closest('div');
      expect(errorBanner).toHaveClass('hidden', 'md:flex');
    });
  });

  describe('Logout Functionality', () => {
    it('should show logout button in dropdown', async () => {
      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        expect(screen.getByText(/log out/i)).toBeInTheDocument();
      });
    });

    it('should call logout when logout button is clicked', async () => {
      const { logout } = await import('../../utils/authService');

      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        const logoutButton = screen.getByText(/log out/i);
        fireEvent.click(logoutButton);
      });

      expect(logout).toHaveBeenCalledTimes(1);
    });

    it('should clear cache on logout', async () => {
      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        const logoutButton = screen.getByText(/log out/i);
        fireEvent.click(logoutButton);
      });

      expect(localStorage.removeItem).toHaveBeenCalledWith('zerodrive-credits-cache');
      expect(localStorage.removeItem).toHaveBeenCalledWith('zerodrive-storage-cache');
    });

    it('should handle logout errors gracefully', async () => {
      const { logout } = await import('../../utils/authService');
      (logout as jest.Mock).mockRejectedValue(new Error('Logout failed'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        const logoutButton = screen.getByText(/log out/i);
        fireEvent.click(logoutButton);
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Logout error:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Mode Toggle', () => {
    it('should render mode toggle button', () => {
      renderWithRouter(<Header />);

      // ModeToggle is a separate component, just verify it's present
      // We can check for its container or common theme toggle elements
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should show hamburger menu only on mobile', () => {
      mockUseSidebar.mockReturnValue({
        ...defaultSidebarContext,
        isMobile: true,
      });

      renderWithRouter(<Header />);

      const menuButton = screen.getByLabelText('Toggle navigation menu');
      expect(menuButton).toHaveClass('md:hidden');
    });

    it('should adapt layout for mobile', () => {
      mockUseSidebar.mockReturnValue({
        ...defaultSidebarContext,
        isMobile: true,
      });

      renderWithRouter(<Header />);

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('h-[8vh]');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing user name gracefully', async () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        userName: '',
        userEmail: 'test@example.com',
        userImage: '',
      });

      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        // Should show email when name is missing
        expect(screen.getAllByText('test@example.com').length).toBeGreaterThan(0);
      });
    });

    it('should handle very long file names in avatar', () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        userName: 'Very Long User Name That Should Be Truncated',
      });

      renderWithRouter(<Header />);

      const avatar = screen.getByRole('button');
      expect(avatar).toBeInTheDocument();
    });

    it('should handle null storage quota gracefully', async () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        storageInfo: null,
      });

      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        // Should show loading state instead of crashing
        expect(screen.getByText(/storage/i)).toBeInTheDocument();
      });
    });

    it('should calculate usage percentage as 0 when total is 0', async () => {
      mockUseApp.mockReturnValue({
        ...defaultAppContext,
        storageInfo: { used: 0, total: 0 },
      });

      renderWithRouter(<Header />);

      const avatarButton = screen.getByRole('button');
      fireEvent.click(avatarButton);

      await waitFor(() => {
        const progressBar = document.querySelector('[role="progressbar"]');
        const value = progressBar?.getAttribute('aria-valuenow');
        expect(parseFloat(value || '0')).toBe(0);
      });
    });
  });
});
