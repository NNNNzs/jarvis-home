/**
 * Express 中间件
 * 
 * @file src/api/middleware.ts
 */

import { Request, Response, NextFunction } from "express";

/**
 * 请求日志中间件
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, url } = req;

  console.log(`[API] → ${method} ${url}`);

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const statusColor = statusCode < 300 ? "🟢" : statusCode < 400 ? "🟡" : "🔴";
    console.log(`[API] ← ${statusCode} ${method} ${url} (${duration}ms) ${statusColor}`);
  });

  next();
}

/**
 * JSON解析错误处理
 */
export function jsonErrorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  if (err.type === "entity.parse.failed") {
    res.status(400).json({
      success: false,
      error: "JSON解析失败",
      message: "请求体必须是有效的JSON格式"
    });
    return;
  }
  next(err);
}

/**
 * CORS配置
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["*"];

  const origin = req.headers.origin;
  if (allowedOrigins.includes("*") || (origin && allowedOrigins.includes(origin))) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }

  next();
}

/**
 * 错误处理中间件 (必须放最后)
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  // 已处理的响应
  if (res.headersSent) {
    return next(err);
  }

  console.error("[Error]", err);

  // 环境变量判断是否暴露详细错误
  const isDev = process.env.NODE_ENV === "development";

  res.status(err.status || 500).json({
    success: false,
    error: err.message || "未知错误",
    ...(isDev && { stack: err.stack })
  });
}

/**
 * 性能监控中间件
 */
export function performanceMonitor(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  // 监控慢请求
  setTimeout(() => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[SLOW] ${req.method} ${req.url} took ${duration}ms`);
    }
  }, 0);

  next();
}

/**
 * API 速率限制 (简单实现)
 */
const requestCounts = new Map<string, number>();

export function rateLimitMiddleware(limit: number = 10, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    // 清理旧记录
    for (const [key, timestamp] of requestCounts) {
      if (timestamp < windowStart) {
        requestCounts.delete(key);
      }
    }

    // 计数
    const count = requestCounts.get(ip) || 0;
    
    if (count >= limit) {
      res.status(429).json({
        success: false,
        error: "请求过于频繁",
        message: `请 ${Math.ceil((windowMs / 1000))} 秒后再试`
      });
      return;
    }

    requestCounts.set(ip, count + 1);
    res.setHeader("X-RateLimit-Remaining", limit - count - 1);
    res.setHeader("X-RateLimit-Limit", limit);
    
    next();
  };
}
