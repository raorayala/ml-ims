import type { NextFunction, Request, Response } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - started;
    console.log(
      `[api] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`,
    );
  });
  next();
}
