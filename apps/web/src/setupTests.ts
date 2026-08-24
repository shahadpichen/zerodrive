// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import { webcrypto } from "crypto";
import { TextDecoder, TextEncoder } from "util";

// Set test environment variables
process.env.REACT_APP_API_URL = "http://localhost:3001";

// Mock window.matchMedia (required for some UI components)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation(
    (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }) as MediaQueryList,
  ),
});

const createStorageMock = (): Storage => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => {
      store[key] = String(value);
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
    key: (index: number): string | null => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
};

// Mock localStorage
const localStorageMock = createStorageMock();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = createStorageMock();

Object.defineProperty(window, "sessionStorage", {
  value: sessionStorageMock,
});

// Clear storage before each test
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

Object.defineProperty(global, "crypto", {
  value: webcrypto as unknown as Crypto,
});

// Add TextEncoder and TextDecoder to global scope
Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder });
Object.defineProperty(globalThis, "TextDecoder", { value: TextDecoder });

// Polyfill File.prototype.arrayBuffer for Jest
// Uses a simpler approach that works in both local and CI environments
if (typeof File !== "undefined" && !File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = async function (
    this: File,
  ): Promise<ArrayBuffer> {
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
          } else if (typeof result === "string") {
            // Convert string to ArrayBuffer
            const encoder = new TextEncoder();
            resolve(encoder.encode(result).buffer);
          } else if (ArrayBuffer.isView(result as unknown as ArrayBufferView)) {
            // Preserve the legacy test behavior for environments that return a
            // typed-array view instead of an ArrayBuffer.
            resolve(
              (result as unknown as ArrayBufferView).buffer as ArrayBuffer,
            );
          } else {
            reject(new Error("Unable to convert file to ArrayBuffer"));
          }
        }
      };
      reader.readAsArrayBuffer(this);
    });
  };
}

// Polyfill Blob.prototype.arrayBuffer for Jest
if (typeof Blob !== "undefined" && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = async function (
    this: Blob,
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.error) {
          reject(reader.error);
        } else {
          const result = reader.result;

          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else if (typeof result === "string") {
            // Convert string to ArrayBuffer
            const encoder = new TextEncoder();
            resolve(encoder.encode(result).buffer);
          } else if (ArrayBuffer.isView(result as unknown as ArrayBufferView)) {
            resolve(
              (result as unknown as ArrayBufferView).buffer as ArrayBuffer,
            );
          } else {
            reject(new Error("Unable to convert blob to ArrayBuffer"));
          }
        }
      };
      reader.readAsArrayBuffer(this);
    });
  };
}

// Polyfill Blob.prototype.text for Jest
if (typeof Blob !== "undefined" && !Blob.prototype.text) {
  Blob.prototype.text = async function (this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.error) {
          reject(reader.error);
        } else {
          resolve(typeof reader.result === "string" ? reader.result : "");
        }
      };
      reader.readAsText(this);
    });
  };
}

// Mock gapi-script globally to prevent ES module import errors
jest.mock("gapi-script", () => ({
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
