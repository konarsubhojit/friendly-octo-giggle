import pino from "pino";

// Create base logger configuration
const isDevelopment = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  // Pretty print in development, JSON in production
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV,
  },
});

export const createLogger = (context: Record<string, unknown>) =>
  logger.child(context);

export const logApiRequest = (data: {
  method: string;
  path: string;
  requestId?: string;
  userId?: string;
  duration?: number;
  statusCode?: number;
}) => {
  const logData = {
    type: "api_request",
    ...data,
  };

  if (data.statusCode && data.statusCode >= 500) {
    // 5xx: server errors — always surfaced in production
    logger.error(logData, "API request server error");
  } else if (data.statusCode && data.statusCode >= 400) {
    // 4xx: client errors (bad input, not found, unauthorized) — warn level
    logger.warn(logData, "API request client error");
  } else {
    // 2xx/3xx: successful — debug only, too high-volume for production info logs
    logger.debug(logData, "API request completed");
  }
};

export const logDatabaseOperation = (data: {
  operation: string;
  model: string;
  duration?: number;
  recordCount?: number;
  success: boolean;
  error?: string;
}) => {
  const logData = {
    type: "database_operation",
    ...data,
  };

  if (data.success) {
    logger.debug(logData, "Database operation completed");
  } else {
    logger.error(logData, "Database operation failed");
  }
};

export const logAuthEvent = (data: {
  event:
    | "login"
    | "logout"
    | "register"
    | "failed_login"
    | "session_created"
    | "session_expired"
    | "password_change";
  userId?: string;
  email?: string;
  provider?: string;
  success: boolean;
  error?: string;
}) => {
  const logData = {
    type: "auth_event",
    ...data,
  };

  // session_created/session_expired fire on every request — log at debug to avoid
  // flooding production logs. Failures are always logged at warn regardless.
  if (data.event === "session_created" || data.event === "session_expired") {
    logger.debug(logData, `Authentication event: ${data.event}`);
  } else if (data.success) {
    logger.info(logData, `Authentication event: ${data.event}`);
  } else {
    logger.warn(logData, `Authentication event failed: ${data.event}`);
  }
};

export const logBusinessEvent = (data: {
  event: string;
  userId?: string;
  details: Record<string, unknown>;
  success: boolean;
}) => {
  const logData = {
    type: "business_event",
    ...data,
  };

  if (data.success) {
    logger.info(logData, `Business event: ${data.event}`);
  } else {
    logger.warn(logData, `Business event failed: ${data.event}`);
  }
};

export const logError = (data: {
  error: unknown;
  context?: string;
  userId?: string;
  requestId?: string;
  additionalInfo?: Record<string, unknown>;
}) => {
  const error =
    data.error instanceof Error ? data.error : new Error(String(data.error));

  logger.error(
    {
      type: "error",
      context: data.context,
      userId: data.userId,
      requestId: data.requestId,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      ...data.additionalInfo,
    },
    `Error occurred: ${data.context || "Unknown context"}`,
  );
};

export const logPerformance = (data: {
  operation: string;
  duration: number;
  metadata?: Record<string, unknown>;
}) => {
  const logData = {
    type: "performance",
    ...data,
  };

  if (data.duration > 1000) {
    logger.warn(logData, `Slow operation detected: ${data.operation}`);
  } else {
    logger.debug(logData, `Performance: ${data.operation}`);
  }
};

export const logCacheOperation = (data: {
  operation: "hit" | "miss" | "set" | "invalidate";
  key: string;
  ttl?: number;
  success: boolean;
}) => {
  const logData = {
    type: "cache_operation",
    ...data,
  };

  logger.debug(logData, `Cache ${data.operation}: ${data.key}`);
};

export const generateRequestId = (): string =>
  `req_${Date.now()}_${crypto.randomUUID()}`;

// Timing utility
export class Timer {
  private readonly startTime: number;
  private readonly label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = Date.now();
  }

  end(metadata?: Record<string, unknown>): number {
    const duration = Date.now() - this.startTime;
    logPerformance({
      operation: this.label,
      duration,
      metadata,
    });
    return duration;
  }
}
