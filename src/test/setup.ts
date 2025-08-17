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