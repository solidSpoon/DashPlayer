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
// jsdom 未实现以下浏览器 API，Radix 系列组件（Select / Popover 等）依赖它们。
globalThis.ResizeObserver = class ResizeObserver {
  observe() {
    // Mock observe method
  }
  unobserve() {
    // Mock unobserve method
  }
  disconnect() {
    // Mock disconnect method
  }
} as unknown as typeof ResizeObserver

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined
}

// jsdom 未实现 requestIdleCallback（首页列表用它做延迟加载），补一个立即执行的回调。
if (!globalThis.requestIdleCallback) {
  globalThis.requestIdleCallback = ((callback: IdleRequestCallback) =>
    window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0)) as typeof globalThis.requestIdleCallback
  globalThis.cancelIdleCallback = ((handle: number) => window.clearTimeout(handle)) as typeof globalThis.cancelIdleCallback
}

// jsdom 未实现 canvas 2D 上下文（getContext 返回 null 并抛 Not implemented），
// 引导页完成页的撒花动画（canvas-confetti）在卸载时会因空上下文报错。
// 这里补一个只接受调用、不做真实绘制的上下文替身。
const canvasContextStub = {
  fillStyle: '',
  strokeStyle: '',
  font: '',
  globalAlpha: 1,
  save: () => undefined,
  restore: () => undefined,
  translate: () => undefined,
  rotate: () => undefined,
  scale: () => undefined,
  beginPath: () => undefined,
  closePath: () => undefined,
  moveTo: () => undefined,
  lineTo: () => undefined,
  arc: () => undefined,
  ellipse: () => undefined,
  fill: () => undefined,
  fillRect: () => undefined,
  clearRect: () => undefined,
  drawImage: () => undefined,
  fillText: () => undefined,
  measureText: () => ({ width: 0 }),
  createPattern: () => null,
}
HTMLCanvasElement.prototype.getContext = (() => canvasContextStub) as unknown as typeof HTMLCanvasElement.prototype.getContext
