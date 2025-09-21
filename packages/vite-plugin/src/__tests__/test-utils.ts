import { vi } from 'vitest';

// Mock types for Vite interfaces
export interface MockViteServer {
  middlewares: {
    use: ReturnType<typeof vi.fn>;
  };
}

export interface MockPluginContext {
  emitFile: ReturnType<typeof vi.fn>;
}

export interface MockRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
}

export interface MockResponse {
  setHeader: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  writeHead?: ReturnType<typeof vi.fn>;
  write?: ReturnType<typeof vi.fn>;
}

// Create a mock Vite server
export function createMockViteServer(): MockViteServer {
  return {
    middlewares: {
      use: vi.fn()
    }
  };
}

// Create a mock plugin context
export function createMockPluginContext(): MockPluginContext {
  return {
    emitFile: vi.fn()
  };
}

// Create a mock HTTP request
export function createMockRequest(url: string, method = 'GET'): MockRequest {
  return {
    url,
    method,
    headers: {}
  };
}

// Create a mock HTTP response
export function createMockResponse(): MockResponse {
  return {
    setHeader: vi.fn(),
    end: vi.fn(),
    writeHead: vi.fn(),
    write: vi.fn()
  };
}

// Helper to capture middleware function from server.middlewares.use
export function captureMockMiddleware(mockServer: MockViteServer) {
  const middlewareCall = mockServer.middlewares.use.mock.calls[0];
  if (!middlewareCall || !middlewareCall[0]) {
    throw new Error('No middleware was registered');
  }
  return middlewareCall[0] as (req: MockRequest, res: MockResponse, next: () => void) => void;
}

// Helper to simulate calling the middleware
export function callMiddleware(
  middleware: (req: MockRequest, res: MockResponse, next: () => void) => void,
  req: MockRequest,
  res: MockResponse
): Promise<boolean> {
  return new Promise((resolve) => {
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
      resolve(false); // false means next() was called (middleware didn't handle request)
    };

    middleware(req, res, next);

    // If next wasn't called synchronously, assume middleware handled the request
    if (!nextCalled) {
      resolve(true); // true means middleware handled the request
    }
  });
}

// Helper to test if a string contains valid JavaScript
export function isValidJavaScript(code: string): boolean {
  try {
    // For ES modules, we need to wrap in a module-like context
    if (code.includes('export')) {
      // Create a simplified ES module check
      const moduleTest = code
        .replace(/export\s+/g, '') // Remove export keywords
        .replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, ''); // Remove import statements
      new Function(moduleTest);
    } else {
      new Function(code);
    }
    return true;
  } catch {
    return false;
  }
}

// Helper to extract values from template strings
export function extractTemplateValue(template: string, placeholder: string): string | null {
  const regex = new RegExp(`${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
  const match = template.match(regex);
  return match ? match[0] : null;
}

// Mock file system operations if needed
export function mockFileSystem() {
  const files = new Map<string, string>();

  return {
    writeFile: (path: string, content: string) => {
      files.set(path, content);
    },
    readFile: (path: string) => {
      return files.get(path) || null;
    },
    exists: (path: string) => {
      return files.has(path);
    },
    clear: () => {
      files.clear();
    },
    getFiles: () => {
      return Array.from(files.keys());
    }
  };
}