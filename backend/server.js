require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Import routes
const groupsRouter = require("./routes/groups");
const usersRouter = require("./routes/users");
const sessionsRouter = require("./routes/sessions");
const proposalsRouter = require("./routes/proposals");
const votesRouter = require("./routes/votes");
const ordersRouter = require("./routes/orders");
const participantsRouter = require("./routes/participants");
const locksRouter = require("./routes/locks");
const testRouter = require("./routes/test");
const sanctumRouter = require("./routes/sanctum"); // Sanctum Gateway routes
const zerionRouter = require("./routes/zerion"); // Zerion Portfolio & Assets routes
const positionsRouter = require("./routes/positions"); // Unified Positions Dashboard
const walletLabelsRouter = require("./routes/wallet-labels"); // Wallet Labels & Tags

// API routes
app.use("/api/groups", groupsRouter);
app.use("/api/users", usersRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/proposals", proposalsRouter);
app.use("/api/votes", votesRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/participants", participantsRouter);
app.use("/api/locks", locksRouter);
app.use("/api/test", testRouter);
app.use("/api/sanctum", sanctumRouter); // Sanctum Gateway endpoints
app.use("/api/zerion", zerionRouter); // Zerion Portfolio & Assets endpoints
app.use("/api/positions", positionsRouter); // Unified Positions Dashboard
app.use("/api/wallet-labels", walletLabelsRouter); // Wallet Labels & Tags

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Telegram Trading Bot API",
    version: "1.0.0",
    endpoints: {
      groups: "/api/groups",
      users: "/api/users",
      sessions: "/api/sessions",
      proposals: "/api/proposals",
      votes: "/api/votes",
      orders: "/api/orders",
      participants: "/api/participants",
      locks: "/api/locks",
      test: "/api/test",
      sanctum: "/api/sanctum",
      zerion: "/api/zerion",
      positions: "/api/positions",
      wallet_labels: "/api/wallet-labels",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API available at http://localhost:${PORT}`);
  console.log(`💚 Health check at http://localhost:${PORT}/health`);
});

module.exports = app;
