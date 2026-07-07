// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Set test environment variables
process.env.REACT_APP_API_URL = 'http://localhost:3001';

// Mock window.matchMedia (required for some UI components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Clear storage before each test
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// Mock Web Crypto API using Node.js crypto
const { webcrypto } = require('crypto');
const { TextEncoder, TextDecoder } = require('util');

Object.defineProperty(global, 'crypto', {
  value: webcrypto,
});

// Add TextEncoder and TextDecoder to global scope
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill File.prototype.arrayBuffer for Jest
// Uses a simpler approach that works in both local and CI environments
if (typeof File !== 'undefined' && !File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = async function() {
    // Read file as text first, then convert to buffer
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.error) {
          reject(reader.error);
        } else {
          // FileReader.readAsArrayBuffer should give us an ArrayBuffer
          // But in some jest environments it might not, so we ensure it
          const result = reader.result;

          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else if (typeof result === 'string') {
            // Convert string to ArrayBuffer
            const encoder = new TextEncoder();
            resolve(encoder.encode(result).buffer);
          } else if (result && result.buffer) {
            // If it's a typed array, get its buffer
            resolve(result.buffer);
          } else {
            reject(new Error('Unable to convert file to ArrayBuffer'));
          }
        }
      };
      reader.readAsArrayBuffer(this);
    });
  };
}

// Polyfill Blob.prototype.arrayBuffer for Jest
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = async function() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.error) {
          reject(reader.error);
        } else {
          const result = reader.result;

          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else if (typeof result === 'string') {
            // Convert string to ArrayBuffer
            const encoder = new TextEncoder();
            resolve(encoder.encode(result).buffer);
          } else if (result && result.buffer) {
            // If it's a typed array, get its buffer
            resolve(result.buffer);
          } else {
            reject(new Error('Unable to convert blob to ArrayBuffer'));
          }
        }
      };
      reader.readAsArrayBuffer(this);
    });
  };
}

// Polyfill Blob.prototype.text for Jest
if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = async function() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.error) {
          reject(reader.error);
        } else {
          resolve(reader.result);
        }
      };
      reader.readAsText(this);
    });
  };
}

// Mock gapi-script globally to prevent ES module import errors
jest.mock('gapi-script', () => ({
  gapi: {
    load: jest.fn(),
    client: {
      init: jest.fn(),
      setToken: jest.fn(),
      request: jest.fn(),
    },
  },
  gapiComplete: jest.fn(),
}));
