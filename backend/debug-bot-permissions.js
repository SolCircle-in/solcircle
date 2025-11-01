#!/usr/bin/env node
/**
 * Debug script to check bot's exact permissions in a group
 * Usage: node debug-bot-permissions.js <group_tgid>
 */

const axios = require('axios');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const tgid = process.argv[2] || '-5043154685'; // Default to test group or provide as argument

async function debugBotPermissions() {
  console.log('🔍 Debugging Bot Permissions');
  console.log('============================\n');
  console.log(`Group TGID: ${tgid}\n`);

  if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found in environment');
    return;
  }

  try {
    // Step 1: Get bot's own info
    console.log('1️⃣  Getting bot info...');
    const botInfoResponse = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getMe`
    );
    
    if (!botInfoResponse.data?.ok) {
      console.error('❌ Failed to get bot info');
      return;
    }

    const botInfo = botInfoResponse.data.result;
    console.log(`✅ Bot: @${botInfo.username} (ID: ${botInfo.id})\n`);

    // Step 2: Get bot's member status in the group
    console.log('2️⃣  Getting bot permissions in group...');
    const memberResponse = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`,
      {
        params: {
          chat_id: tgid,
          user_id: botInfo.id,
        },
      }
    );

    if (!memberResponse.data?.ok) {
      console.error('❌ Failed to get bot member info');
      console.error(`   Error: ${memberResponse.data?.description}`);
      return;
    }

    const member = memberResponse.data.result;
    console.log('✅ Bot member info retrieved\n');

    // Step 3: Display detailed permissions
    console.log('📋 Bot Status:', member.status);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (member.status === 'creator') {
      console.log('👑 Bot is the GROUP CREATOR');
      console.log('   Has all permissions by default\n');
    } else if (member.status === 'administrator') {
      console.log('👮 Bot is an ADMINISTRATOR\n');
      console.log('Permissions:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const permissions = [
        { key: 'can_be_edited', label: 'Can Be Edited', icon: '🔧' },
        { key: 'can_manage_chat', label: 'Manage Chat', icon: '⚙️' },
        { key: 'can_delete_messages', label: 'Delete Messages', icon: '🗑️' },
        { key: 'can_manage_video_chats', label: 'Manage Video Chats', icon: '📹' },
        { key: 'can_restrict_members', label: 'Restrict Members', icon: '🚫' },
        { key: 'can_promote_members', label: 'Promote Members', icon: '⬆️' },
        { key: 'can_change_info', label: 'Change Group Info', icon: 'ℹ️' },
        { key: 'can_invite_users', label: 'Invite Users via Link', icon: '🔗', critical: true },
        { key: 'can_pin_messages', label: 'Pin Messages', icon: '📌' },
        { key: 'can_manage_topics', label: 'Manage Topics', icon: '📋' },
      ];

      permissions.forEach(perm => {
        const value = member[perm.key];
        const status = value ? '✅' : '❌';
        const display = `${status} ${perm.icon} ${perm.label}`;
        
        if (perm.critical && !value) {
          console.log(`${display} ⚠️  REQUIRED FOR INVITE LINKS`);
        } else {
          console.log(display);
        }
      });

      // Check the critical permission
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      if (member.can_invite_users) {
        console.log('✅ Bot CAN create invite links');
      } else {
        console.log('❌ Bot CANNOT create invite links');
        console.log('\n📝 How to Fix:');
        console.log('   1. Open Telegram group');
        console.log('   2. Tap group name → Administrators');
        console.log(`   3. Find @${botInfo.username}`);
        console.log('   4. Tap to edit permissions');
        console.log('   5. Enable "Invite Users via Link" ✅');
        console.log('   6. Save changes');
      }
    } else if (member.status === 'member') {
      console.log('👤 Bot is a REGULAR MEMBER (not admin)');
      console.log('\n❌ Bot needs to be promoted to administrator');
      console.log('\n📝 How to Fix:');
      console.log('   1. Open Telegram group');
      console.log('   2. Tap group name → Administrators');
      console.log('   3. Tap "Add Administrator"');
      console.log(`   4. Select @${botInfo.username}`);
      console.log('   5. Enable "Invite Users via Link" ✅');
      console.log('   6. Tap ✓ to save');
    } else {
      console.log(`⚠️  Unexpected status: ${member.status}`);
    }

  } catch (error) {
    console.error('\n❌ Error occurred:');
    if (error.response?.data) {
      console.error('   API Error:', error.response.data.description);
      
      if (error.response.data.description?.includes('chat not found')) {
        console.error('\n💡 Tip: Make sure the bot is a member of the group');
        console.error('   Add the bot to the group first!');
      }
    } else {
      console.error('   ', error.message);
    }
  }
}

// Run the debug
console.log('\n');
debugBotPermissions().then(() => {
  console.log('\n');
  process.exit(0);
});
