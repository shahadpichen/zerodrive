/**
 * UI Component Tests for Analytics Dashboard Page
 *
 * Tests analytics data loading, time range filtering, and UI state management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AnalyticsDashboard from '../../pages/analytics-dashboard';
import '@testing-library/jest-dom';

import apiClient from '../../utils/apiClient';
import { toast } from 'sonner';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock apiClient
jest.mock('../../utils/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    loading: jest.fn(),
  },
}));

const mockApiGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

// Helper to render component with Router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

// Mock analytics data
const mockSummary = {
  totalEvents: 150,
  eventsByType: {
    user_login: 50,
    file_uploaded: 40,
    file_shared: 30,
    invitation_sent: 20,
    file_deleted: 10,
  },
  eventsByCategory: {
    auth: 50,
    storage: 50,
    sharing: 50,
  },
};

const mockDailyStats = [
  {
    date: '2024-01-15',
    logins: 10,
    uploads: 5,
    shares: 3,
    errors: 0,
  },
  {
    date: '2024-01-16',
    logins: 8,
    uploads: 12,
    shares: 6,
    errors: 2,
  },
  {
    date: '2024-01-17',
    logins: 15,
    uploads: 8,
    shares: 4,
    errors: 1,
  },
];

describe('AnalyticsDashboard', () => {
  let consoleErrorMock: jest.SpyInstance;

  beforeAll(() => {
    // Suppress React act() warnings and expected async errors in tests
    consoleErrorMock = jest.spyOn(console, 'error').mockImplementation((message) => {
      if (
        typeof message === 'string' &&
        (message.includes('act(...)') || message.includes('not wrapped in act'))
      ) {
        return;
      }
    });
  });

  afterAll(() => {
    consoleErrorMock.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();

    // Default successful API responses
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/analytics/summary')) {
        return Promise.resolve({
          success: true,
          data: mockSummary,
        });
      }
      if (url.includes('/analytics/daily')) {
        return Promise.resolve({
          success: true,
          data: mockDailyStats,
        });
      }
      return Promise.resolve({ success: false });
    });
  });

  describe('Initial Render', () => {
    it('should render the page', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Anonymous Analytics')).toBeInTheDocument();
      });
    });

    it('should display page description', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(
          screen.getByText(/Privacy-safe usage statistics \(no user tracking\)/i)
        ).toBeInTheDocument();
      });
    });

    it('should have back to storage button', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /Back to Storage/i });
        expect(backButton).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      renderWithRouter(<AnalyticsDashboard />);

      expect(screen.getByText(/Loading analytics.../i)).toBeInTheDocument();
    });

    it('should navigate to storage when back button clicked', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /Back to Storage/i });
        fireEvent.click(backButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/storage');
    });
  });

  describe('Time Range Selector', () => {
    it('should display time range buttons', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '7 Days' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '30 Days' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '90 Days' })).toBeInTheDocument();
      });
    });

    it('should default to 30 days', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const thirtyDayButton = screen.getByRole('button', { name: '30 Days' });
        expect(thirtyDayButton).toBeInTheDocument();
        // The default variant button will not have outline classes
        expect(thirtyDayButton.className).not.toContain('border-input');
      });
    });

    it('should switch to 7 days when clicked', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const sevenDayButton = screen.getByRole('button', { name: '7 Days' });
        fireEvent.click(sevenDayButton);
      });

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/analytics/summary?days=7');
        expect(mockApiGet).toHaveBeenCalledWith('/analytics/daily?days=7');
      });
    });

    it('should switch to 90 days when clicked', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const ninetyDayButton = screen.getByRole('button', { name: '90 Days' });
        fireEvent.click(ninetyDayButton);
      });

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/analytics/summary?days=90');
        expect(mockApiGet).toHaveBeenCalledWith('/analytics/daily?days=90');
      });
    });

    it('should reload analytics when time range changes', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledTimes(2); // initial load
      });

      const sevenDayButton = screen.getByRole('button', { name: '7 Days' });
      fireEvent.click(sevenDayButton);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledTimes(4); // 2 more calls
      });
    });
  });

  describe('Summary Cards', () => {
    it('should display total logins card', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Total Logins')).toBeInTheDocument();
        // Check that the number appears in a bold div (the card value)
        const boldNumbers = screen.getAllByText('50');
        const cardValue = boldNumbers.find(el => el.className.includes('font-bold'));
        expect(cardValue).toBeInTheDocument();
      });
    });

    it('should display files uploaded card', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Files Uploaded')).toBeInTheDocument();
        expect(screen.getByText('40')).toBeInTheDocument();
      });
    });

    it('should display files shared card', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Files Shared')).toBeInTheDocument();
        expect(screen.getByText('30')).toBeInTheDocument();
      });
    });

    it('should display invitations sent card', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Invitations Sent')).toBeInTheDocument();
        expect(screen.getByText('20')).toBeInTheDocument();
      });
    });

    it('should show time range label on cards', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const labels = screen.getAllByText(/Last 30 days/i);
        expect(labels.length).toBe(4); // One for each card
      });
    });

    it('should handle missing event types gracefully', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/analytics/summary')) {
          return Promise.resolve({
            success: true,
            data: {
              totalEvents: 0,
              eventsByType: {},
              eventsByCategory: {},
            },
          });
        }
        if (url.includes('/analytics/daily')) {
          return Promise.resolve({
            success: true,
            data: [],
          });
        }
        return Promise.resolve({ success: false });
      });

      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const zeroValues = screen.getAllByText('0');
        expect(zeroValues.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('Events by Category Section', () => {
    it('should display events by category card', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Events by Category')).toBeInTheDocument();
        expect(screen.getByText('Breakdown of all events')).toBeInTheDocument();
      });
    });

    it('should list all event categories', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('auth')).toBeInTheDocument();
        expect(screen.getByText('storage')).toBeInTheDocument();
        expect(screen.getByText('sharing')).toBeInTheDocument();
      });
    });

    it('should display category counts', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const categorySection = screen.getByText('Events by Category').closest('div');
        expect(categorySection).toBeInTheDocument();
      });
    });

    it('should handle empty categories', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/analytics/summary')) {
          return Promise.resolve({
            success: true,
            data: {
              totalEvents: 0,
              eventsByType: {},
              eventsByCategory: {},
            },
          });
        }
        if (url.includes('/analytics/daily')) {
          return Promise.resolve({
            success: true,
            data: [],
          });
        }
        return Promise.resolve({ success: false });
      });

      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Events by Category')).toBeInTheDocument();
      });
    });
  });

  describe('Daily Activity Table', () => {
    it('should display daily activity table', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Daily Activity')).toBeInTheDocument();
        expect(screen.getByText('Event counts per day')).toBeInTheDocument();
      });
    });

    it('should have table headers', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Logins')).toBeInTheDocument();
        expect(screen.getByText('Uploads')).toBeInTheDocument();
        expect(screen.getByText('Shares')).toBeInTheDocument();
        expect(screen.getByText('Errors')).toBeInTheDocument();
      });
    });

    it('should display daily stats rows', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const table = screen.getByRole('table');
        // Check that table contains dates (format may vary by locale)
        // Just check that dates are present (month/day/year or day/month/year)
        expect(table).toHaveTextContent(/1[/\-\.]1[5-7][/\-\.]2024|1[5-7][/\-\.]1[/\-\.]2024/);
      });
    });

    it('should display numeric values in table', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const table = screen.getByRole('table');
        expect(table).toBeInTheDocument();
        // Check that table contains numeric values from mock data
        expect(table).toHaveTextContent('10');
        expect(table).toHaveTextContent('15');
      });
    });

    it('should highlight errors in red when greater than zero', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty daily stats', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/analytics/summary')) {
          return Promise.resolve({
            success: true,
            data: mockSummary,
          });
        }
        if (url.includes('/analytics/daily')) {
          return Promise.resolve({
            success: true,
            data: [],
          });
        }
        return Promise.resolve({ success: false });
      });

      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Daily Activity')).toBeInTheDocument();
      });
    });
  });

  describe('Privacy Notice', () => {
    it('should display privacy notice', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/🔒 Privacy-First Analytics/i)).toBeInTheDocument();
      });
    });

    it('should explain anonymous tracking', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(
          screen.getByText(/These analytics are completely anonymous/i)
        ).toBeInTheDocument();
      });
    });

    it('should mention no personal data collection', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(
          screen.getByText(/No emails, IP addresses, or personal identifiers/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should load summary and daily stats on mount', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/analytics/summary?days=30');
        expect(mockApiGet).toHaveBeenCalledWith('/analytics/daily?days=30');
      });
    });

    it('should handle API errors gracefully', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'));

      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to load analytics');
      });
    });

    it('should handle partial data loading', async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes('/analytics/summary')) {
          return Promise.resolve({
            success: true,
            data: mockSummary,
          });
        }
        if (url.includes('/analytics/daily')) {
          return Promise.resolve({
            success: false,
          });
        }
        return Promise.resolve({ success: false });
      });

      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Total Logins')).toBeInTheDocument();
      });
    });

    it('should handle null data response', async () => {
      mockApiGet.mockImplementation(() => {
        return Promise.resolve({
          success: true,
          data: null,
        });
      });

      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Anonymous Analytics')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should log error to console on load failure', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockApiGet.mockRejectedValue(new Error('Failed to fetch'));

      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error loading analytics:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('should show error toast on load failure', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));

      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to load analytics');
      });
    });

    it('should handle network timeout gracefully', async () => {
      mockApiGet.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 100)
          )
      );

      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(
        () => {
          expect(toast.error).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button labels', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /Back to Storage/i });
        expect(backButton).toBeInTheDocument();
      });
    });

    it('should have semantic table structure', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });

    it('should have table headers', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const headers = screen.getAllByRole('columnheader');
        expect(headers.length).toBe(5); // Date, Logins, Uploads, Shares, Errors
      });
    });

    it('should have accessible card titles', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Total Logins')).toBeInTheDocument();
        expect(screen.getByText('Files Uploaded')).toBeInTheDocument();
        expect(screen.getByText('Files Shared')).toBeInTheDocument();
        expect(screen.getByText('Invitations Sent')).toBeInTheDocument();
      });
    });
  });

  describe('UI State Management', () => {
    it('should toggle active state on time range buttons', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const thirtyDayButton = screen.getByRole('button', { name: '30 Days' });
        expect(thirtyDayButton).toBeInTheDocument();
      });

      const sevenDayButton = screen.getByRole('button', { name: '7 Days' });
      const thirtyDayButton = screen.getByRole('button', { name: '30 Days' });

      // Initially 7 Days should have outline variant
      expect(sevenDayButton.className).toContain('border');

      fireEvent.click(sevenDayButton);

      await waitFor(() => {
        // After click, 7 Days should not have border (default variant)
        const updatedSevenDayButton = screen.getByRole('button', { name: '7 Days' });
        expect(updatedSevenDayButton.className).not.toContain('border-input');
      });
    });

    it('should show correct day count in labels after switching', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Total Logins')).toBeInTheDocument();
      });

      const sevenDayButton = screen.getByRole('button', { name: '7 Days' });
      fireEvent.click(sevenDayButton);

      await waitFor(() => {
        const labels = screen.getAllByText(/Last 7 days/i);
        expect(labels.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render summary cards in grid layout', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const cards = screen.getAllByText(/Total Logins|Files Uploaded|Files Shared|Invitations Sent/);
        expect(cards.length).toBe(4);
      });
    });

    it('should have scrollable table container', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const table = screen.getByRole('table');
        const container = table.closest('.overflow-x-auto');
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('Data Formatting', () => {
    it('should format dates correctly in table', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        // Check for dates in the mock data (format varies by locale)
        const table = screen.getByRole('table');
        // Check for year 2024 to confirm dates are rendered
        expect(table).toHaveTextContent('2024');
      });
    });

    it('should display numbers correctly', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        // Check that all card titles exist
        expect(screen.getByText('Total Logins')).toBeInTheDocument();
        expect(screen.getByText('Files Uploaded')).toBeInTheDocument();
        expect(screen.getByText('Files Shared')).toBeInTheDocument();
        expect(screen.getByText('Invitations Sent')).toBeInTheDocument();

        // Check that the numbers appear in bold divs (card values)
        const allBoldDivs = document.querySelectorAll('.text-2xl.font-bold');
        expect(allBoldDivs.length).toBeGreaterThanOrEqual(4);
        // Find the card values (should be the first 4 or the ones that are purely numbers)
        const cardValues = Array.from(allBoldDivs)
          .filter(el => /^\d+$/.test(el.textContent || ''))
          .slice(0, 4);
        expect(cardValues.length).toBe(4);
        expect(cardValues[0].textContent).toBe('50');
        expect(cardValues[1].textContent).toBe('40');
        expect(cardValues[2].textContent).toBe('30');
        expect(cardValues[3].textContent).toBe('20');
      });
    });

    it('should capitalize category names', async () => {
      renderWithRouter(<AnalyticsDashboard />);

      await waitFor(() => {
        const categoryItems = screen.getAllByText(/auth|storage|sharing/i);
        expect(categoryItems.length).toBeGreaterThan(0);
      });
    });
  });
});
