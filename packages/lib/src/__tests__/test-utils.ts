import type { WorkerifyRequest, WorkerifyReply } from '../types.js';

// Mock BroadcastChannel for testing
export class MockBroadcastChannel {
  private listeners: Array<(event: { data: any }) => void> = [];
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  postMessage(data: any) {
    // Simulate async message delivery
    setTimeout(() => {
      this.listeners.forEach(listener => {
        listener({ data });
      });
    }, 0);
  }

  addEventListener(type: string, listener: (event: { data: any }) => void) {
    if (type === 'message') {
      this.listeners.push(listener);
    }
  }

  removeEventListener(type: string, listener: (event: { data: any }) => void) {
    if (type === 'message') {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    }
  }

  close() {
    this.listeners = [];
  }

  set onmessage(handler: ((event: { data: any }) => void) | null) {
    if (handler) {
      this.addEventListener('message', handler);
    }
  }
}

// Helper to create mock requests
export function createMockRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/',
  headers: Record<string, string> = {},
  body?: ArrayBuffer
): WorkerifyRequest {
  return {
    url,
    method: method as any,
    headers: {
      'user-agent': 'test',
      ...headers
    },
    body: body || null,
    params: {}
  };
}

// Helper to create mock replies
export function createMockReply(): WorkerifyReply {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    bodyType: 'json'
  };
}

// Setup global mocks for BroadcastChannel
export function setupBroadcastChannelMock() {
  // @ts-ignore
  global.BroadcastChannel = MockBroadcastChannel;
}

// Cleanup function
export function cleanup() {
  // Reset any global state if needed
}

// Wait for async operations to complete
export function waitForAsync(ms: number = 10) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Convert string to ArrayBuffer for testing
export function stringToArrayBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer;
}

// Convert ArrayBuffer to string for testing
export function arrayBufferToString(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder();
  return decoder.decode(buffer);
}