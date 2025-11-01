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
        username: chat.username,
        description: chat.description,
        invite_link: chat.invite_link,
        join_by_request: chat.join_by_request,
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

/**
 * Create a chat invite link (optionally as join request link)
 * @param {string} botToken - Telegram bot token
 * @param {string|number} chatId - Telegram group/supergroup chat ID
 * @param {object} options - { name?, expire_date?, member_limit?, creates_join_request? }
 * @returns {Promise<Object>} - { success, invite_link, raw }
 */
async function createChatInviteLink(botToken, chatId, options = {}) {
  try {
    const params = {
      chat_id: chatId,
      ...options,
    };

    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
      params
    );

    if (response.data?.ok) {
      return {
        success: true,
        invite_link: response.data.result?.invite_link,
        raw: response.data.result,
      };
    }

    return {
      success: false,
      error: response.data?.description || 'Failed to create invite link',
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.description || error.message,
    };
  }
}

/**
 * Approve a pending chat join request
 * @param {string} botToken
 * @param {string|number} chatId
 * @param {number} userId
 * @returns {Promise<{success:boolean,error?:string}>}
 */
async function approveChatJoinRequest(botToken, chatId, userId) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/approveChatJoinRequest`,
      {
        chat_id: chatId,
        user_id: userId,
      }
    );

    return { success: !!response.data?.ok };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.description || error.message,
    };
  }
}

/**
 * Check if bot has required permissions in a group
 * @param {string} botToken - Telegram bot token
 * @param {string|number} chatId - Telegram group chat ID
 * @returns {Promise<Object>} - { success, isAdmin, canInviteUsers, canManageChat, needsPermissions }
 */
async function checkBotPermissions(botToken, chatId) {
  try {
    // Get bot's own user info first
    const botInfoResponse = await axios.get(
      `https://api.telegram.org/bot${botToken}/getMe`
    );
    
    if (!botInfoResponse.data?.ok) {
      return {
        success: false,
        error: 'Failed to get bot info',
      };
    }

    const botId = botInfoResponse.data.result.id;

    // Get bot's member status in the chat
    const response = await axios.get(
      `https://api.telegram.org/bot${botToken}/getChatMember`,
      {
        params: {
          chat_id: chatId,
          user_id: botId,
        },
      }
    );

    if (response.data?.ok) {
      const member = response.data.result;
      const isAdmin = member.status === 'administrator' || member.status === 'creator';
      const canInviteUsers = member.can_invite_users || false;
      const canManageChat = member.can_manage_chat || false;

      const needsPermissions = [];
      if (!isAdmin) {
        needsPermissions.push('Bot must be an administrator');
      }
      if (isAdmin && !canInviteUsers) {
        needsPermissions.push('Bot needs "Invite Users via Link" permission');
      }

      return {
        success: true,
        isAdmin,
        canInviteUsers,
        canManageChat,
        status: member.status,
        needsPermissions,
        canCreateInviteLinks: isAdmin && canInviteUsers,
      };
    }

    return {
      success: false,
      error: 'Failed to get bot member info',
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.description || error.message,
    };
  }
}

module.exports = {
  verifyGroupOwnership,
  getChatInfo,
  sendVerificationMessage,
  createChatInviteLink,
  approveChatJoinRequest,
  checkBotPermissions,
};
