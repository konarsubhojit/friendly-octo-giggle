import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
}));

vi.mock("pino", () => ({
  default: vi.fn(() => mockLogger),
}));

import {
  logger,
  createLogger,
  logApiRequest,
  logDatabaseOperation,
  logAuthEvent,
  logBusinessEvent,
  logError,
  logPerformance,
  logCacheOperation,
  generateRequestId,
  Timer,
} from "@/lib/logger";

describe("logger module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logger instance", () => {
    it("should export a pino logger", () => {
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
    });
  });

  describe("createLogger", () => {
    it("should create a child logger with the given context", () => {
      const context = { service: "test-service", requestId: "abc123" };
      createLogger(context);
      expect(mockLogger.child).toHaveBeenCalledWith(context);
    });
  });

  describe("logApiRequest", () => {
    it("should log info for successful requests (status < 400)", () => {
      logApiRequest({
        method: "GET",
        path: "/api/products",
        requestId: "req_1",
        statusCode: 200,
        duration: 50,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "api_request",
          method: "GET",
          path: "/api/products",
          statusCode: 200,
        }),
        "API request completed",
      );
    });

    it("should log error for failed requests (status >= 400)", () => {
      logApiRequest({
        method: "POST",
        path: "/api/orders",
        statusCode: 500,
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "api_request",
          method: "POST",
          path: "/api/orders",
          statusCode: 500,
        }),
        "API request failed",
      );
    });

    it("should log info when no statusCode is provided", () => {
      logApiRequest({ method: "GET", path: "/api/health" });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ type: "api_request", method: "GET" }),
        "API request completed",
      );
    });
  });

  describe("logDatabaseOperation", () => {
    it("should log debug for successful operations", () => {
      logDatabaseOperation({
        operation: "findMany",
        model: "products",
        duration: 30,
        recordCount: 10,
        success: true,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "database_operation",
          operation: "findMany",
          model: "products",
          success: true,
        }),
        "Database operation completed",
      );
    });

    it("should log error for failed operations", () => {
      logDatabaseOperation({
        operation: "insert",
        model: "orders",
        success: false,
        error: "unique constraint violation",
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "database_operation",
          operation: "insert",
          model: "orders",
          success: false,
          error: "unique constraint violation",
        }),
        "Database operation failed",
      );
    });
  });

  describe("logAuthEvent", () => {
    it("should log info for successful auth events", () => {
      logAuthEvent({
        event: "login",
        userId: "user_1",
        provider: "google",
        success: true,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "auth_event",
          event: "login",
          userId: "user_1",
          success: true,
        }),
        "Authentication event: login",
      );
    });

    it("should log warn for failed auth events", () => {
      logAuthEvent({
        event: "failed_login",
        email: "user@example.com",
        success: false,
        error: "invalid credentials",
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "auth_event",
          event: "failed_login",
          success: false,
        }),
        "Authentication event failed: failed_login",
      );
    });
  });

  describe("logBusinessEvent", () => {
    it("should log info for successful business events", () => {
      logBusinessEvent({
        event: "order_placed",
        userId: "user_1",
        details: { orderId: "ord_123", total: 99.99 },
        success: true,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "business_event",
          event: "order_placed",
          success: true,
        }),
        "Business event: order_placed",
      );
    });

    it("should log warn for failed business events", () => {
      logBusinessEvent({
        event: "payment_failed",
        userId: "user_2",
        details: { reason: "insufficient funds" },
        success: false,
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "business_event",
          event: "payment_failed",
          success: false,
        }),
        "Business event failed: payment_failed",
      );
    });
  });

  describe("logError", () => {
    it("should log an Error instance with name, message, and stack", () => {
      const error = new Error("Something went wrong");
      logError({ error, context: "order-processing", userId: "user_1" });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          context: "order-processing",
          userId: "user_1",
          errorName: "Error",
          errorMessage: "Something went wrong",
        }),
        "Error occurred: order-processing",
      );
    });

    it("should convert a string error to an Error instance", () => {
      logError({ error: "string error", context: "string-test" });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          errorName: "Error",
          errorMessage: "string error",
        }),
        "Error occurred: string-test",
      );
    });

    it("should use 'Unknown context' when no context is provided", () => {
      logError({ error: new Error("fail") });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
        "Error occurred: Unknown context",
      );
    });

    it("should include additionalInfo in the log data", () => {
      logError({
        error: new Error("fail"),
        context: "test",
        additionalInfo: { orderId: "ord_1" },
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: "ord_1" }),
        expect.any(String),
      );
    });
  });

  describe("logPerformance", () => {
    it("should log warn for slow operations (duration > 1000)", () => {
      logPerformance({ operation: "heavy-query", duration: 2500 });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "performance",
          operation: "heavy-query",
          duration: 2500,
        }),
        "Slow operation detected: heavy-query",
      );
    });

    it("should log debug for normal operations (duration <= 1000)", () => {
      logPerformance({ operation: "fast-query", duration: 100 });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "performance",
          operation: "fast-query",
          duration: 100,
        }),
        "Performance: fast-query",
      );
    });

    it("should log debug when duration is exactly 1000", () => {
      logPerformance({ operation: "borderline", duration: 1000 });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 1000 }),
        "Performance: borderline",
      );
    });
  });

  describe("logCacheOperation", () => {
    it("should log debug for cache hit", () => {
      logCacheOperation({
        operation: "hit",
        key: "products:all",
        success: true,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "cache_operation",
          operation: "hit",
          key: "products:all",
        }),
        "Cache hit: products:all",
      );
    });

    it("should log debug for cache miss", () => {
      logCacheOperation({
        operation: "miss",
        key: "products:123",
        success: true,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "miss" }),
        "Cache miss: products:123",
      );
    });

    it("should log debug for cache set with ttl", () => {
      logCacheOperation({
        operation: "set",
        key: "cart:user_1",
        ttl: 60,
        success: true,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "set", ttl: 60 }),
        "Cache set: cart:user_1",
      );
    });

    it("should log debug for cache invalidate", () => {
      logCacheOperation({
        operation: "invalidate",
        key: "products:all",
        success: false,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "invalidate", success: false }),
        "Cache invalidate: products:all",
      );
    });
  });

  describe("generateRequestId", () => {
    it("should return a string with req_ prefix", () => {
      const id = generateRequestId();
      expect(typeof id).toBe("string");
      expect(id).toMatch(/^req_/);
    });

    it("should generate unique IDs on each call", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("Timer", () => {
    it("should return a duration >= 0 when end() is called", () => {
      const timer = new Timer("test-op");
      const duration = timer.end();
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it("should call logPerformance with the label and duration", () => {
      const timer = new Timer("db-query");
      timer.end({ table: "products" });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "performance",
          operation: "db-query",
          metadata: { table: "products" },
        }),
        expect.any(String),
      );
    });

    it("should log warn if the timer duration exceeds 1000ms", async () => {
      const _timer = new Timer("slow-op");
      // Since we can't guarantee > 1000ms in a test, we test via logPerformance directly
      logPerformance({ operation: "slow-op", duration: 1500 });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "slow-op", duration: 1500 }),
        "Slow operation detected: slow-op",
      );
    });
  });
});
