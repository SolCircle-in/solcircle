require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  // Increase timeout to handle long-running operations (like swaps)
  connectionTimeoutMillis: 60000, // 60 seconds
  idleTimeoutMillis: 60000, // 60 seconds
  statement_timeout: 60000, // 60 seconds for query execution
});

pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected database error:", err);
  process.exit(-1);
});

module.exports = pool;
