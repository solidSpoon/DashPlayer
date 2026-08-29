import '@testing-library/jest-dom'
import 'reflect-metadata'
import { vi } from 'vitest'

// Extend global interface for electron APIs
declare global {
  interface Window {
    electronAPI: {
      invoke: ReturnType<typeof vi.fn>
      onMainProc: ReturnType<typeof vi.fn>
      offMainProc: ReturnType<typeof vi.fn>
    }
  }
}

declare const globalThis: {
  electronAPI: {
    invoke: ReturnType<typeof vi.fn>
    onMainProc: ReturnType<typeof vi.fn>
    offMainProc: ReturnType<typeof vi.fn>
  }
  IntersectionObserver: typeof IntersectionObserver
} & typeof global

// Mock electron APIs for frontend tests
globalThis.electronAPI = {
  invoke: vi.fn(),
  onMainProc: vi.fn(),
  offMainProc: vi.fn(),
}

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: globalThis.electronAPI,
  writable: true,
})

// Mock window.electron
const mockElectron = {
  call: vi.fn().mockResolvedValue({}),
  safeCall: vi.fn().mockResolvedValue({}),
  registerRendererApi: vi.fn(),
  onTaskUpdate: vi.fn(),
  onStoreUpdate: vi.fn(),
  onErrorMsg: vi.fn(),
  onInfoMsg: vi.fn(),
  dpLogger: {
    write: vi.fn(),
  },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).electron = mockElectron;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).electron = mockElectron;



// Mock IntersectionObserver
globalThis.IntersectionObserver = class IntersectionObserver {
  observe() {
    // Mock observe method
  }
  unobserve() {
    // Mock unobserve method
  }
  disconnect() {
    // Mock disconnect method
  }
} as unknown as typeof IntersectionObserver

// Mock HTMLMediaElement play/pause methods
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  writable: true,
  value: vi.fn().mockImplementation(() => Promise.resolve()),
})

Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  writable: true,
  value: vi.fn(),
})