import rateLimit from "express-rate-limit";

export const holdRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Max 10 hold requests per IP per minute
  message: {
    success: false,
    message: "Too many booking attempts. Please try again after a minute."
  },
  standardHeaders: true,
  legacyHeaders: false,
});