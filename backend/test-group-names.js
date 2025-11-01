#!/usr/bin/env node
/**
 * Test fetching Telegram group names
 * Usage: node test-group-names.js
 */

const axios = require('axios');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = 'http://localhost:8000';

async function testGroupNames() {
  console.log('🧪 Testing Telegram Group Name Fetching');
  console.log('=========================================\n');

  if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found in environment');
    return;
  }

  try {
    // Step 1: Get groups from backend
    console.log('1️⃣  Fetching groups from backend...');
    const groupsResponse = await axios.get(`${BASE_URL}/api/groups`);
    const groups = groupsResponse.data.data;
    console.log(`✅ Found ${groups.length} groups\n`);

    // Step 2: Fetch Telegram info for first 3 groups
    console.log('2️⃣  Fetching Telegram group info...\n');
    
    const testGroups = groups.slice(0, 3); // Test first 3 groups
    
    for (const group of testGroups) {
      console.log(`📱 Group TGID: ${group.tgid}`);
      console.log(`   DB Status: ${group.status}`);
      
      try {
        // Call Telegram API directly
        const response = await axios.get(
          `https://api.telegram.org/bot${BOT_TOKEN}/getChat`,
          { params: { chat_id: group.tgid } }
        );
        
        if (response.data?.ok) {
          const chat = response.data.result;
          console.log(`   ✅ Name: "${chat.title}"`);
          console.log(`   📝 Description: ${chat.description || 'N/A'}`);
          console.log(`   👥 Members: ${chat.member_count || 'N/A'}`);
          console.log(`   🔗 Username: ${chat.username ? '@' + chat.username : 'N/A'}`);
          console.log(`   🔒 Type: ${chat.type}`);
        } else {
          console.log(`   ❌ Failed to get info: ${response.data?.description}`);
        }
      } catch (err) {
        console.log(`   ❌ Error: ${err.response?.data?.description || err.message}`);
      }
      
      console.log('');
    }

    // Step 3: Test the new endpoint with includeGroupInfo
    console.log('3️⃣  Testing new endpoint with includeGroupInfo...\n');
    const enrichedResponse = await axios.get(`${BASE_URL}/api/groups`, {
      params: { includeGroupInfo: 'true' }
    });
    
    if (enrichedResponse.data.success && enrichedResponse.data.data[0]?.telegram) {
      console.log('✅ Endpoint returns enriched data!');
      console.log('\nSample enriched group:');
      const sample = enrichedResponse.data.data[0];
      console.log(`   TGID: ${sample.tgid}`);
      console.log(`   Name: ${sample.telegram?.title || 'N/A'}`);
      console.log(`   Members: ${sample.telegram?.memberCount || 'N/A'}`);
    } else {
      console.log('⚠️  Endpoint not returning telegram info');
      console.log('   Make sure to restart the backend server!');
      console.log('   Run: pkill -f "node server.js" && node server.js');
    }

  } catch (error) {
    console.error('\n❌ Test failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error:`, error.response.data);
    } else {
      console.error(`   ${error.message}`);
    }
  }
}

// Run the test
testGroupNames().then(() => process.exit(0));
