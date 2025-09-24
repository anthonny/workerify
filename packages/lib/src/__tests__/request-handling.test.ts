import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workerify } from '../index.js';
import type { WorkerifyReply, WorkerifyRequest } from '../types.js';
import {
  createMockReply,
  createMockRequest,
  setupBroadcastChannelMock,
  stringToArrayBuffer,
  waitForAsync,
} from './test-utils.js';

// Setup mocks
setupBroadcastChannelMock();

describe('Request Handling', () => {
  let workerify: Workerify;

  beforeEach(() => {
    workerify = new Workerify({ logger: false });
  });

  afterEach(() => {
    workerify.close();
  });

  describe('Basic request handling', () => {
    it('should handle simple GET request', async () => {
      const handler = vi.fn().mockReturnValue('Hello World');
      workerify.get('/test', handler);

      const request = createMockRequest('GET', 'http://localhost:3000/test');

      // Simulate message handling
      const handleRequest = (workerify as any).handleRequest.bind(workerify);
      const sendResponse = vi
        .spyOn(workerify as any, 'sendResponse')
        .mockImplementation(() => {});

      await handleRequest('test-id', request);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:3000/test',
          method: 'GET',
          params: {},
        }),
        expect.objectContaining({
          status: 200,
          statusText: 'OK',
        }),
      );

      expect(sendResponse).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          body: 'Hello World',
          bodyType: 'text',
          headers: { 'Content-Type': 'text/html' },
        }),
      );
    });

    it('should handle POST request with JSON body', async () => {
      const handler = vi.fn().mockReturnValue({ success: true });
      workerify.post('/api/data', handler);

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/data',
      );

      const handleRequest = (workerify as any).handleRequest.bind(workerify);
      const sendResponse = vi
        .spyOn(workerify as any, 'sendResponse')
        .mockImplementation(() => {});

      await handleRequest('test-id', request);

      expect(handler).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          body: { success: true },
          bodyType: 'json',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should handle request with parameters', async () => {
      const handler = vi.fn().mockReturnValue('User found');
      workerify.get('/users/:id', handler);

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/users/123',
      );

      const handleRequest = (workerify as any).handleRequest.bind(workerify);
      await handleRequest('test-id', request);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { id: '123' },
        }),
        expect.any(Object),
      );
    });
  });

  describe('Form data handling', () => {
    it('should parse form-encoded data in POST requests', async () => {
      const handler = vi.fn().mockImplementation((req) => {
        return { receivedData: req.body };
      });
      workerify.post('/form', handler);

      const formData = 'name=John&age=30&city=NYC';
      const request = createMockRequest(
        'POST',
        'http://localhost:3000/form',
        { 'content-type': 'application/x-www-form-urlencoded' },
        stringToArrayBuffer(formData),
      );

      const handleRequest = (workerify as any).handleRequest.bind(workerify);
      await handleRequest('test-id', request);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            name: 'John',
            age: '30',
            city: 'NYC',
          },
        }),
        expect.any(Object),
      );
    });

    it('should handle malformed form data gracefully', async () => {
      const handler = vi.fn().mockReturnValue('ok');
      workerify.post('/form', handler);

      const invalidFormData = 'invalid%form%data%';
      const request = createMockRequest(
        'POST',
        'http://localhost:3000/form',
        { 'content-type': 'application/x-www-form-urlencoded' },
        stringToArrayBuffer(invalidFormData),
      );

      const handleRequest = (workerify as any).handleRequest.bind(workerify);

      // Should not throw
      await expect(handleRequest('test-id', request)).resolves.not.toThrow();
    });

    it('should not process form data for GET requests', async () => {
      const handler = vi.fn().mockReturnValue('ok');
      workerify.get('/test', handler);

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/test',
        { 'content-type': 'application/x-www-form-urlencoded' },
        stringToArrayBuffer('name=value'),
      );

      const handleRequest = (workerify as any).handleRequest.bind(workerify);
      await handleRequest('test-id', request);

      // Verify that handler was called and body is still an ArrayBuffer (not parsed as form data)
      expect(handler).toHaveBeenCalled();
      const [requestArg] = handler.mock.calls[0];
      // For GET requests, the body should remain as ArrayBuffer and not be parsed as form data
      expect(requestArg.body?.constructor?.name).toBe('ArrayBuffer');
      expect(requestArg.method).toBe('GET');
      expect(requestArg.url).toBe('http://localhost:3000/test');
    });
  });

  describe('Response handling', () => {
    it('should return string responses with correct content type', async () => {
      const handler = vi.fn().mockReturnValue('<h1>Hello</h1>');
      workerify.get('/html', handler);

      const request = createMockRequest('GET', 'http://localhost:3000/html');
      const handleRequest = (workerify as any).handleRequest.bind(workerify);
      const sendResponse = vi
        .spyOn(workerify as any, 'sendResponse')
        .mockImplementation(() => {});

      await handleRequest('test-id', request);

      expect(sendResponse).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          body: '<h1>Hello</h1>',
          bodyType: 'text',
          headers: { 'Content-Type': 'text/html' },
        }),
      );
    });

    it('should return JSON responses with correct content type', async () => {
      const responseData = { message: 'Hello', status: 'success' };
      const handler = vi.fn().mockReturnValue(responseData);
      workerify.get('/json', handler);

      const request = createMockRequest('GET', 'http://localhost:3000/json');
      const handleRequest = (workerify as any).handleRequest.bind(workerify);
      const sendResponse = vi
        .spyOn(workerify as any, 'sendResponse')
        .mockImplementation(() => {});

      await handleRequest('test-id', request);

      expect(sendResponse).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          body: responseData,
          bodyType: 'json',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should return ArrayBuffer responses', async () => {
      const buffer = stringToArrayBuffer('binary data');
      const handler = vi.fn().mockReturnValue(buffer);
      workerify.get('/binary', handler);

      const request = createMockRequest('GET', 'http://localhost:3000/binary');
      const handleRequest = (workerify as any).handleRequest.bind(workerify);
      const sendResponse = vi
        .spyOn(workerify as any, 'sendResponse')
        .mockImplementation(() => {});

      await handleRequest('test-id', request);

      expect(sendResponse).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          body: buffer,
          // Note: ArrayBuffer detection might not work in jsdom, so we check the body
        }),
      );
    });

    it('should handle undefined return values', async () => {
      const handler = vi.fn().mockReturnValue(undefined);
      workerify.get('/undefined', handler);

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/undefined',
      );
      const handleRequest = (workerify as any).handleRequest.bind(workerify);
      const sendResponse = vi
        .spyOn(workerify as any, 'sendResponse')
        .mockImplementation(() => {});

      await handleRequest('test-id', request);

      expect(sendResponse).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          bodyType: 'json',
          // Note: undefined body won't be set on the reply object
        }),
      );
    });

    it('should allow handlers to modify reply object', async () => {
      const handler = vi.fn().mockImplementation((req, reply) => {
        reply.status = 201;
        reply.statusText = 'Created';
        reply.headers = { 'X-Custom': 'value' };
        return { id: 123 };
      });
      workerify.post('/create', handler);

      const request = createMockRequest('POST', 'http://localhost:3000/create');
      const handleRequest = (workerify as any).handleRequest.bind(workerify);
      const sendResponse = vi
        .spyOn(workerify as any, 'sendResponse')
        .mockImplementation(() => {});

      await handleRequest('test-id', request);

      expect(sendResponse).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          status: 201,
          statusText: 'Created',
          headers: expect.objectContaining({
            'X-Custom': 'value',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });

  describe('Error handling', () => {
    it('should handle route not found', async () => {
      const request = createMockRequest(
        'GET',
        'http://localhost:3000/nonexistent',
      );
      const handleRequest = (workerify as any).handleRequest.bind(workerify);
      const sendResponse = vi
        .spyOn(workerify as any, 'sendResponse')
        .mockImplementation(() => {});

      await handleRequest('test-id', request);

      expect(sendResponse).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          status: 404,
          statusText: 'Not Found',
          body: { error: 'Route not found' },
          bodyType: 'json',
        }),
      );
    });

    it('should handle handler errors', async () => {
      const handler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      workerify.get('/error', handler);

      const request = createMockRequest('GET', 'http://localhost:3000/error');
      const handleRequest = (workerify as any).handleRequest.bind(workerify);
      const sendResponse = vi
        .spyOn(workerify as any, 'sendResponse')
        .mockImplementation(() => {});

      await handleRequest('test-id', request);

      expect(sendResponse).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          status: 500,
          statusText: 'Internal Server Error',
          body: { error: 'Internal server error' },
          bodyType: 'json',
        }),
      );
    });

    it('should handle async handler errors', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Async error'));
      workerify.get('/async-error', handler);

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/async-error',
      );
      const handleRequest = (workerify as any).handleRequest.bind(workerify);
      const sendResponse = vi
        .spyOn(workerify as any, 'sendResponse')
        .mockImplementation(() => {});

      await handleRequest('test-id', request);

      expect(sendResponse).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );
    });
  });

  describe('Message handling integration', () => {
    it('should handle incoming messages correctly', async () => {
      const handler = vi.fn().mockReturnValue('response');
      workerify.get('/test', handler);

      // Mock the channel's message handling
      const handleMessage = (workerify as any).handleMessage.bind(workerify);
      const handleRequest = vi
        .spyOn(workerify as any, 'handleRequest')
        .mockImplementation(() => {});

      const consumerId = (workerify as any).consumerId;
      const message = {
        data: {
          type: 'workerify:handle',
          id: 'test-id',
          consumerId: consumerId,
          request: createMockRequest('GET', 'http://localhost:3000/test'),
        },
      };

      handleMessage(message);

      expect(handleRequest).toHaveBeenCalledWith(
        'test-id',
        message.data.request,
      );
    });

    it('should ignore non-workerify messages', async () => {
      const handleMessage = (workerify as any).handleMessage.bind(workerify);
      const handleRequest = vi
        .spyOn(workerify as any, 'handleRequest')
        .mockImplementation(() => {});

      const message = {
        data: {
          type: 'other:message',
          id: 'test-id',
        },
      };

      handleMessage(message);

      expect(handleRequest).not.toHaveBeenCalled();
    });

    it('should ignore malformed messages', async () => {
      const handleMessage = (workerify as any).handleMessage.bind(workerify);
      const handleRequest = vi
        .spyOn(workerify as any, 'handleRequest')
        .mockImplementation(() => {});

      const message = {
        data: {
          type: 'workerify:handle',
          // Missing id and request
        },
      };

      handleMessage(message);

      expect(handleRequest).not.toHaveBeenCalled();
    });
  });

  describe('BroadcastChannel response sending', () => {
    it('should send response via BroadcastChannel', () => {
      const postMessage = vi.spyOn(workerify['channel'], 'postMessage');
      const sendResponse = (workerify as any).sendResponse.bind(workerify);

      const reply: WorkerifyReply = {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        body: { message: 'test' },
        bodyType: 'json',
      };

      sendResponse('test-id', reply);

      expect(postMessage).toHaveBeenCalledWith({
        type: 'workerify:response',
        id: 'test-id',
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        body: { message: 'test' },
        bodyType: 'json',
      });
    });
  });
});
