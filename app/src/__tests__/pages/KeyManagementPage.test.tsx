/**
 * UI Component Tests for Key Management Page
 *
 * Tests user interactions, warning flows, and UI state management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { KeyManagementPage } from '../../pages/key-management-page';
import '@testing-library/jest-dom';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Helper to render component with Router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('KeyManagementPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockNavigate.mockClear();
  });

  describe('Initial Render', () => {
    it('should render the page', () => {
      renderWithRouter(<KeyManagementPage />);
      expect(screen.getByText('Recover Your Key')).toBeInTheDocument();
    });

    it('should show recover mode by default', () => {
      renderWithRouter(<KeyManagementPage />);
      expect(
        screen.getByPlaceholderText(/Enter your 12 or 24 word mnemonic/i)
      ).toBeInTheDocument();
    });

    it('should have a switch to generate mode link', () => {
      renderWithRouter(<KeyManagementPage />);
      expect(
        screen.getByText(/Don't have a key\? Create new secure mnemonic/i)
      ).toBeInTheDocument();
    });

    it('should have back button to storage', () => {
      renderWithRouter(<KeyManagementPage />);
      const backButton = screen.getByLabelText(/Back to Storage/i);
      expect(backButton).toBeInTheDocument();
    });
  });

  describe('View Mode Switching', () => {
    it('should switch to generate mode when clicking link', () => {
      renderWithRouter(<KeyManagementPage />);

      const switchLink = screen.getByText(/Don't have a key/i);
      fireEvent.click(switchLink);

      expect(screen.getByText('Create New Key')).toBeInTheDocument();
      expect(
        screen.getByText(/Generate New Secure Mnemonic & Key/i)
      ).toBeInTheDocument();
    });

    it('should switch back to recover mode', () => {
      renderWithRouter(<KeyManagementPage />);

      // Switch to generate
      fireEvent.click(screen.getByText(/Don't have a key/i));

      // Switch back to recover
      const recoverLink = screen.getByText(/Already have a key/i);
      fireEvent.click(recoverLink);

      expect(screen.getByText('Recover Your Key')).toBeInTheDocument();
    });
  });

  describe('Warning Dialog Flow', () => {
    beforeEach(() => {
      renderWithRouter(<KeyManagementPage />);
      // Switch to generate mode
      fireEvent.click(screen.getByText(/Don't have a key/i));
    });

    it('should show warning dialog when clicking generate button', () => {
      const generateBtn = screen.getByText(/Generate New Secure Mnemonic & Key/i);
      fireEvent.click(generateBtn);

      expect(
        screen.getByText(/IMPORTANT: Read Before Generating Key/i)
      ).toBeInTheDocument();
    });

    it('should show warning about permanent loss', () => {
      const generateBtn = screen.getByText(/Generate New Secure Mnemonic/i);
      fireEvent.click(generateBtn);

      expect(
        screen.getByText(/Your Files Will Be PERMANENTLY Lost/i)
      ).toBeInTheDocument();
    });

    it('should have two required checkboxes in warning dialog', () => {
      const generateBtn = screen.getByText(/Generate New Secure Mnemonic/i);
      fireEvent.click(generateBtn);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    });

    it('should disable generate button until both checkboxes checked', () => {
      const generateBtn = screen.getByText(/Generate New Secure Mnemonic/i);
      fireEvent.click(generateBtn);

      const confirmBtn = screen.getByText(/I Understand, Generate My Key/i);
      expect(confirmBtn).toBeDisabled();
    });

    it('should keep button disabled with only first checkbox', () => {
      const generateBtn = screen.getByText(/Generate New Secure Mnemonic/i);
      fireEvent.click(generateBtn);

      const checkbox1 = screen.getByLabelText(/permanent loss of ALL my files/i);
      fireEvent.click(checkbox1);

      const confirmBtn = screen.getByText(/I Understand, Generate My Key/i);
      expect(confirmBtn).toBeDisabled();
    });

    it('should enable generate button when both checkboxes checked', () => {
      const generateBtn = screen.getByText(/Generate New Secure Mnemonic/i);
      fireEvent.click(generateBtn);

      const checkbox1 = screen.getByLabelText(/permanent loss of ALL my files/i);
      const checkbox2 = screen.getByLabelText(/prepared to save my backup phrase/i);

      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);

      const confirmBtn = screen.getByText(/I Understand, Generate My Key/i);
      expect(confirmBtn).not.toBeDisabled();
    });

    it('should close dialog on cancel', () => {
      const generateBtn = screen.getByText(/Generate New Secure Mnemonic/i);
      fireEvent.click(generateBtn);

      const cancelBtn = screen.getByText('Cancel');
      fireEvent.click(cancelBtn);

      expect(
        screen.queryByText(/IMPORTANT: Read Before Generating Key/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('Mnemonic Generation', () => {
    beforeEach(() => {
      renderWithRouter(<KeyManagementPage />);
      // Switch to generate mode
      fireEvent.click(screen.getByText(/Don't have a key/i));
    });

    it('should generate and display mnemonic after warning', async () => {
      // Open dialog
      const generateBtn = screen.getByText(/Generate New Secure Mnemonic/i);
      fireEvent.click(generateBtn);

      // Check both boxes
      const checkbox1 = screen.getByLabelText(/permanent loss of ALL/i);
      const checkbox2 = screen.getByLabelText(/prepared to save/i);
      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);

      // Confirm
      const confirmBtn = screen.getByText(/I Understand, Generate My Key/i);
      fireEvent.click(confirmBtn);

      // Wait for mnemonic to appear
      await waitFor(() => {
        expect(screen.getByText('Mnemonic Generated!')).toBeInTheDocument();
      });
    });

    it('should display 12-word mnemonic', async () => {
      // Generate mnemonic
      const generateBtn = screen.getByText(/Generate New Secure Mnemonic/i);
      fireEvent.click(generateBtn);

      const checkbox1 = screen.getByLabelText(/permanent loss of ALL/i);
      const checkbox2 = screen.getByLabelText(/prepared to save/i);
      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);

      const confirmBtn = screen.getByText(/I Understand, Generate My Key/i);
      fireEvent.click(confirmBtn);

      // Check mnemonic has 12 words
      await waitFor(() => {
        const textarea = screen.getByDisplayValue(/\w+/) as HTMLTextAreaElement;
        const value = textarea.value || textarea.textContent || '';
        const words = value.trim().split(/\s+/).filter(w => w.length > 0);
        expect(words.length).toBe(12);
      });
    });

    it('should show download button after generation', async () => {
      // Generate mnemonic
      const generateBtn = screen.getByText(/Generate New Secure Mnemonic/i);
      fireEvent.click(generateBtn);

      const checkbox1 = screen.getByLabelText(/permanent loss of ALL/i);
      const checkbox2 = screen.getByLabelText(/prepared to save/i);
      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);

      const confirmBtn = screen.getByText(/I Understand, Generate My Key/i);
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/Download Mnemonic/i)).toBeInTheDocument();
      });
    });

    it('should show Test Your Key button after generation', async () => {
      // Generate mnemonic
      const generateBtn = screen.getByText(/Generate New Secure Mnemonic/i);
      fireEvent.click(generateBtn);

      const checkbox1 = screen.getByLabelText(/permanent loss of ALL/i);
      const checkbox2 = screen.getByLabelText(/prepared to save/i);
      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);

      const confirmBtn = screen.getByText(/I Understand, Generate My Key/i);
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/Test Your Key/i)).toBeInTheDocument();
      });
    });
  });

  describe('Recovery Mode', () => {
    beforeEach(() => {
      renderWithRouter(<KeyManagementPage />);
    });

    it('should have textarea for mnemonic input', () => {
      expect(
        screen.getByPlaceholderText(/Enter your 12 or 24 word mnemonic/i)
      ).toBeInTheDocument();
    });

    it('should have Load Key button', () => {
      expect(screen.getByText(/Load Key from Mnemonic/i)).toBeInTheDocument();
    });

    it('should disable Load button when input is empty', () => {
      const loadBtn = screen.getByText(/Load Key from Mnemonic/i);
      expect(loadBtn).toBeDisabled();
    });

    it('should enable Load button when input has text', () => {
      const textarea = screen.getByPlaceholderText(/Enter your 12 or 24 word mnemonic/i);
      fireEvent.change(textarea, { target: { value: 'test mnemonic phrase' } });

      const loadBtn = screen.getByText(/Load Key from Mnemonic/i);
      expect(loadBtn).not.toBeDisabled();
    });

    it('should show advanced file upload option', () => {
      const advancedBtn = screen.getByText(/Advanced: Use Existing Key File/i);
      expect(advancedBtn).toBeInTheDocument();
    });

    it('should toggle file upload section', () => {
      const advancedBtn = screen.getByText(/Advanced: Use Existing Key File/i);
      fireEvent.click(advancedBtn);

      expect(screen.getByText(/Upload your encryption key file/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid mnemonic gracefully', async () => {
      renderWithRouter(<KeyManagementPage />);

      const textarea = screen.getByPlaceholderText(/Enter your 12 or 24 word mnemonic/i);
      fireEvent.change(textarea, { target: { value: 'invalid mnemonic' } });

      const loadBtn = screen.getByText(/Load Key from Mnemonic/i);
      fireEvent.click(loadBtn);

      await waitFor(() => {
        // Should show error (implementation dependent)
        expect(
          screen.queryByText(/Invalid mnemonic/i) ||
            screen.queryByText(/Failed/i) ||
            document.querySelector('[class*="destructive"]')
        ).toBeTruthy();
      });
    });
  });

  describe('Device Management Section', () => {
    it('should render device management component', () => {
      renderWithRouter(<KeyManagementPage />);

      expect(
        screen.getByText(/Using ZeroDrive on Other Devices/i)
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for inputs', () => {
      renderWithRouter(<KeyManagementPage />);

      const textarea = screen.getByPlaceholderText(/Enter your 12 or 24 word mnemonic/i);
      expect(textarea).toHaveAttribute('id');
    });

    it('should have accessible button labels', () => {
      renderWithRouter(<KeyManagementPage />);

      const backButton = screen.getByLabelText(/Back to Storage/i);
      expect(backButton).toBeInTheDocument();
    });
  });
});
