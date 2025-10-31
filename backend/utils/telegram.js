const axios = require('axios');

/**
 * Verify if a user is the owner/admin of a Telegram group
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram group chat ID
 * @param {string} userId - Telegram user ID to verify
 * @returns {Promise<Object>} - { isOwner, isAdmin, status }
 */
async function verifyGroupOwnership(botToken, chatId, userId) {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${botToken}/getChatMember`,
      {
        params: {
          chat_id: chatId,
          user_id: userId
        }
      }
    );

    if (response.data.ok) {
      const member = response.data.result;
      const status = member.status;
      
      return {
        success: true,
        isOwner: status === 'creator',
        isAdmin: status === 'creator' || status === 'administrator',
        status: status,
        canManageChat: member.can_manage_chat || false,
        userId: member.user.id,
        username: member.user.username,
        firstName: member.user.first_name
      };
    }

    return {
      success: false,
      error: 'Failed to get chat member info'
    };
  } catch (error) {
    console.error('Telegram verification error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.description || error.message
    };
  }
}

/**
 * Get Telegram chat information
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram group chat ID
 * @returns {Promise<Object>} - Chat information
 */
async function getChatInfo(botToken, chatId) {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${botToken}/getChat`,
      {
        params: { chat_id: chatId }
      }
    );

    if (response.data.ok) {
      const chat = response.data.result;
      return {
        success: true,
        id: chat.id,
        title: chat.title,
        type: chat.type,
        description: chat.description,
        memberCount: chat.member_count || 0
      };
    }

    return {
      success: false,
      error: 'Failed to get chat info'
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.description || error.message
    };
  }
}

/**
 * Send verification message to Telegram group
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram group chat ID
 * @param {string} verificationCode - Verification code to send
 * @returns {Promise<Object>}
 */
async function sendVerificationMessage(botToken, chatId, verificationCode) {
  try {
    const message = `🔐 Group Registration Verification\n\nYour verification code is: \`${verificationCode}\`\n\nThis code will expire in 10 minutes.`;
    
    const response = await axios.get(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        params: {
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        }
      }
    );

    return {
      success: response.data.ok,
      messageId: response.data.result?.message_id
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.description || error.message
    };
  }
}

module.exports = {
  verifyGroupOwnership,
  getChatInfo,
  sendVerificationMessage
};
