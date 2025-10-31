const redis = require("redis");

// Redis client instance
let redisClient = null;

/**
 * Initialize Redis client
 * @returns {Promise<void>}
 */
async function initRedis() {
  if (redisClient) return;

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  redisClient = redis.createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error("❌ Redis connection failed after 10 retries");
          return new Error("Redis connection failed");
        }
        return retries * 1000; // Exponential backoff
      },
    },
  });

  redisClient.on("error", (err) => console.error("Redis Client Error:", err));
  redisClient.on("connect", () => console.log("✅ Redis connected"));
  redisClient.on("reconnecting", () => console.log("🔄 Redis reconnecting..."));

  await redisClient.connect();
}

/**
 * Get Redis client instance
 * @returns {Object} Redis client
 */
function getRedisClient() {
  if (!redisClient) {
    throw new Error("Redis client not initialized. Call initRedis() first.");
  }
  return redisClient;
}

/**
 * Close Redis connection
 * @returns {Promise<void>}
 */
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log("✅ Redis connection closed");
  }
}

// --- Session Management Functions ---

const SESSION_PREFIX = "session:";
const SESSION_BY_CHAT_PREFIX = "session:chat:";
const SESSION_TTL = 86400; // 24 hours

/**
 * Save session to Redis
 * @param {string} sessionId - Session ID
 * @param {Object} sessionData - Session data
 * @param {number} ttl - Time to live in seconds (default: 24h)
 * @returns {Promise<void>}
 */
async function saveSession(sessionId, sessionData, ttl = SESSION_TTL) {
  // Type validation with detailed error messages
  if (!sessionId) {
    throw new Error(`sessionId is required, got: ${sessionId}`);
  }
  if (typeof sessionId !== 'string') {
    throw new Error(`sessionId must be a string, got ${typeof sessionId}: ${JSON.stringify(sessionId)}`);
  }
  if (!sessionData) {
    throw new Error(`sessionData is required, got: ${sessionData}`);
  }
  if (typeof sessionData !== 'object' || Array.isArray(sessionData)) {
    throw new Error(`sessionData must be an object, got ${typeof sessionData}: ${JSON.stringify(sessionData)}`);
  }
  if (typeof ttl !== 'number') {
    throw new Error(`ttl must be a number, got ${typeof ttl}: ${ttl}`);
  }

  // Clean the session data - remove sessionId if it exists (it shouldn't be stored in the data)
  const cleanData = { ...sessionData };
  delete cleanData.sessionId;

  const key = `${SESSION_PREFIX}${sessionId}`;
  const serializedData = JSON.stringify(cleanData);
  await redisClient.setEx(key, ttl, serializedData);

  // Also maintain a mapping of chatId -> sessionId for quick lookups
  if (cleanData.chatId) {
    const chatKey = `${SESSION_BY_CHAT_PREFIX}${cleanData.chatId}`;
    await redisClient.setEx(chatKey, ttl, String(sessionId));
  }
}

/**
 * Get session from Redis
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} Session data or null if not found
 */
async function getSession(sessionId) {
  const key = `${SESSION_PREFIX}${sessionId}`;
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Get session by chat ID
 * @param {number} chatId - Telegram chat ID
 * @returns {Promise<Object|null>} Session data with ID or null if not found
 */
async function getSessionByChatId(chatId) {
  const chatKey = `${SESSION_BY_CHAT_PREFIX}${chatId}`;
  const sessionId = await redisClient.get(chatKey);

  if (!sessionId) return null;

  const sessionData = await getSession(sessionId);
  if (!sessionData) return null;

  return { sessionId, ...sessionData };
}

/**
 * Get all active sessions for a chat (including closed but not expired)
 * @param {number} chatId - Telegram chat ID
 * @returns {Promise<Array>} Array of session objects with IDs
 */
async function getAllSessionsForChat(chatId) {
  try {
    // Use KEYS for simple pattern matching (fine for small datasets)
    // For production with many keys, consider using SCAN with cursor
    const allKeys = await redisClient.keys(`${SESSION_PREFIX}*`);

    const sessions = [];

    for (const key of allKeys) {
      try {
        // Skip chat mapping keys - they contain sessionId as value, not session data
        console.log("Checking session key:", key);
        if (key.startsWith(SESSION_BY_CHAT_PREFIX)) {
          continue;
        }

        const data = await redisClient.get(key);
        if (data) {
          const sessionData = JSON.parse(data);
          // Compare chatId as both number and string to handle type mismatches
          if (sessionData.chatId == chatId) {
            const sessionId = key.replace(SESSION_PREFIX, "");
            sessions.push({ sessionId, ...sessionData });
          }
        }
      } catch (parseError) {
        console.error(`Error parsing session data for key ${key}:`, parseError);
        // Continue with next session
      }
    }

    return sessions;
  } catch (error) {
    console.error('Error in getAllSessionsForChat:', error);
    return [];
  }
}

/**
 * Update session data
 * @param {string} sessionId - Session ID
 * @param {Object} updates - Partial session data to update
 * @returns {Promise<void>}
 */
async function updateSession(sessionId, updates) {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const updatedSession = { ...session, ...updates };
  await saveSession(sessionId, updatedSession);
}

/**
 * Delete session from Redis
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
async function deleteSession(sessionId) {
  const session = await getSession(sessionId);
  if (session) {
    const chatKey = `${SESSION_BY_CHAT_PREFIX}${session.chatId}`;
    await redisClient.del(chatKey);
  }

  const key = `${SESSION_PREFIX}${sessionId}`;
  await redisClient.del(key);
}

/**
 * Find active session in a chat
 * @param {number} chatId - Telegram chat ID
 * @returns {Promise<Object|null>} Active session with ID or null
 */
async function findActiveSession(chatId) {
  // First try to get the session using the chat mapping (most efficient)
  const chatKey = `${SESSION_BY_CHAT_PREFIX}${chatId}`;
  const mappedSessionId = await redisClient.get(chatKey);

  if (mappedSessionId) {
    const session = await getSession(mappedSessionId);
    if (session && session.open) {
      return { sessionId: mappedSessionId, ...session };
    }
  }

  // Fallback: scan all sessions if mapping doesn't work
  const sessions = await getAllSessionsForChat(chatId);
  const activeSessions = sessions.filter(s => s.open);

  // Return the most recent active session (sessionId is a timestamp string)
  if (activeSessions.length > 0) {
    return activeSessions.sort((a, b) => {
      // Convert string sessionIds to numbers for comparison
      return Number(b.sessionId) - Number(a.sessionId);
    })[0];
  }

  return null;
}

/**
 * Add participant to session
 * @param {string} sessionId - Session ID
 * @param {string} username - Username to add
 * @returns {Promise<void>}
 */
async function addParticipant(sessionId, username) {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  if (!session.participants.includes(username)) {
    session.participants.push(username);
    await saveSession(sessionId, session);
  }
}

/**
 * Add proposal to session
 * @param {string} sessionId - Session ID
 * @param {Object} proposal - Proposal object
 * @returns {Promise<void>}
 */
async function addProposal(sessionId, proposal) {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  if (!session.proposals) {
    session.proposals = [];
  }
  session.proposals.push(proposal);
  await saveSession(sessionId, session);
}

/**
 * Update proposal in session
 * @param {string} sessionId - Session ID
 * @param {string} proposalId - Proposal ID
 * @param {Object} updates - Partial proposal data to update
 * @returns {Promise<void>}
 */
async function updateProposal(sessionId, proposalId, updates) {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const proposalIndex = session.proposals.findIndex(p => p.id === proposalId);
  if (proposalIndex === -1) {
    throw new Error(`Proposal ${proposalId} not found in session ${sessionId}`);
  }

  session.proposals[proposalIndex] = {
    ...session.proposals[proposalIndex],
    ...updates,
  };

  await saveSession(sessionId, session);
}

/**
 * Get proposal from session
 * @param {string} sessionId - Session ID
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<Object|null>} Proposal object or null
 */
async function getProposal(sessionId, proposalId) {
  const session = await getSession(sessionId);
  if (!session || !session.proposals) return null;

  return session.proposals.find(p => p.id === proposalId) || null;
}

/**
 * Find active proposal in session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} Active proposal or null
 */
async function findActiveProposal(sessionId) {
  const session = await getSession(sessionId);
  if (!session || !session.proposals) return null;

  // Return the most recent open proposal
  const openProposals = session.proposals.filter(p => p.open);
  if (openProposals.length > 0) {
    return openProposals[openProposals.length - 1];
  }

  return null;
}

/**
 * Add vote to proposal
 * @param {string} sessionId - Session ID
 * @param {string} proposalId - Proposal ID
 * @param {string} username - Username
 * @param {Object} voteData - Vote data {vote: 'yes'|'no', amount: number}
 * @returns {Promise<void>}
 */
async function addVote(sessionId, proposalId, username, voteData) {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const proposalIndex = session.proposals.findIndex(p => p.id === proposalId);
  if (proposalIndex === -1) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  if (!session.proposals[proposalIndex].votes) {
    session.proposals[proposalIndex].votes = {};
  }

  session.proposals[proposalIndex].votes[username] = voteData;
  await saveSession(sessionId, session);
}

module.exports = {
  initRedis,
  getRedisClient,
  closeRedis,
  saveSession,
  getSession,
  getSessionByChatId,
  getAllSessionsForChat,
  updateSession,
  deleteSession,
  findActiveSession,
  addParticipant,
  addProposal,
  updateProposal,
  getProposal,
  findActiveProposal,
  addVote,
};
