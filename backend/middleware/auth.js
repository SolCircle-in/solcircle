const jwt = require("jsonwebtoken");

/**
 * Authentication middleware
 * Verifies JWT token from httpOnly cookie OR internal API key
 * Attaches user info to req.user if token is valid
 */
const auth = (req, res, next) => {
  // Check for internal API key (for bot.js and internal services)
  const apiKey = req.headers["x-api-key"] || req.headers["x-internal-key"];
  const internalApiKey = process.env.INTERNAL_API_KEY || "internal-secret-key-change-in-production";

  if (apiKey === internalApiKey) {
    // Internal service bypass - mark as internal request
    req.internal = true;
    return next();
  }

  // Otherwise, check for JWT token
  const token = req.cookies?.token;

  // If no token, allow request to continue (optional auth)
  if (!token) {
    return next();
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || "your-secret-key-change-in-production";
    const decoded = jwt.verify(token, jwtSecret);

    // Attach user info to request
    req.user = {
      id: decoded.id,
      username: decoded.username,
    };

    next();
  } catch (err) {
    // Token is invalid or expired
    console.error("JWT verification error:", err.message);

    // Clear invalid cookie
    res.clearCookie("token");

    // Continue without user (optional auth)
    return next();
  }
};

/**
 * Require authentication middleware
 * Returns 401 if user is not authenticated (unless internal API key)
 */
const requireAuth = (req, res, next) => {
  // Check for internal API key first (for bot.js)
  const apiKey = req.headers["x-api-key"] || req.headers["x-internal-key"];
  const internalApiKey = process.env.INTERNAL_API_KEY || "internal-secret-key-change-in-production";

  if (apiKey === internalApiKey) {
    // Internal service bypass
    req.internal = true;
    return next();
  }

  // Otherwise, require JWT token
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Please login.",
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || "your-secret-key-change-in-production";
    const decoded = jwt.verify(token, jwtSecret);

    // Attach user info to request
    req.user = {
      id: decoded.id,
      username: decoded.username,
    };

    next();
  } catch (err) {
    console.error("JWT verification error:", err.message);

    // Clear invalid cookie
    res.clearCookie("token");

    return res.status(403).json({
      success: false,
      error: "Invalid or expired token. Please login again.",
    });
  }
};

module.exports = { auth, requireAuth };
