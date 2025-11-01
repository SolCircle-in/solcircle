#!/usr/bin/env node
/**
 * Test script to verify the invite route is properly registered
 * Run: node test-invite-route.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8000';
const TEST_TGID = '-5043154685'; // Use one of the existing groups

async function testInviteRoute() {
  console.log('🧪 Testing Invite Route');
  console.log('========================\n');

  try {
    // Test 1: Check if backend is running
    console.log('1️⃣  Testing if backend is running...');
    const healthCheck = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Backend is running\n');

    // Test 2: Get groups to verify tgid exists
    console.log('2️⃣  Fetching groups list...');
    const groupsResponse = await axios.get(`${BASE_URL}/api/groups`);
    const groups = groupsResponse.data.data;
    console.log(`✅ Found ${groups.length} groups`);
    
    const testGroup = groups.find(g => g.tgid === TEST_TGID);
    if (testGroup) {
      console.log(`✅ Test group ${TEST_TGID} exists\n`);
    } else {
      console.log(`⚠️  Test group ${TEST_TGID} not found, using first group instead`);
      const firstGroupId = groups[0]?.tgid;
      console.log(`   Using group: ${firstGroupId}\n`);
    }

    // Test 3: Try to create invite link
    const targetTgid = testGroup ? TEST_TGID : groups[0]?.tgid;
    console.log(`3️⃣  Creating invite link for group ${targetTgid}...`);
    
    const inviteResponse = await axios.post(
      `${BASE_URL}/api/groups/${targetTgid}/invite`,
      { joinRequest: true },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (inviteResponse.data.success) {
      console.log('✅ Invite link created successfully!');
      console.log(`   Link: ${inviteResponse.data.invite_link}`);
      console.log(`   Join request: ${inviteResponse.data.join_request}`);
    } else {
      console.log('❌ Failed to create invite link');
      console.log(`   Error: ${inviteResponse.data.error}`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:');
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
      
      if (error.response.status === 404) {
        console.error('\n💡 This suggests the route is not registered.');
        console.error('   Make sure to restart the backend server after adding the route.');
        console.error('   Run: pkill -f "node server.js" && node server.js');
      }
    } else if (error.request) {
      console.error('   No response received. Is the backend running?');
    } else {
      console.error(`   ${error.message}`);
    }
  }
}

// Run the test
testInviteRoute();
