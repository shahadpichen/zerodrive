/**
 * Test Script for Mailgun Email Integration
 *
 * Run with: npx ts-node src/scripts/testEmail.ts
 *
 * Make sure to set the following environment variables first:
 * - MAILGUN_API_KEY
 * - MAILGUN_DOMAIN
 * - MAILGUN_FROM_NAME
 * - MAILGUN_FROM_EMAIL
 * - APP_URL
 */

// IMPORTANT: Load environment variables BEFORE importing other modules
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Now import modules that depend on environment variables
import { sendFileShareNotification, testEmailConfiguration } from '../services/emailService';

async function main() {
  console.log('=== Mailgun Email Integration Test ===\n');

  // Test 1: Check configuration
  console.log('Test 1: Checking Mailgun configuration...');
  const configValid = await testEmailConfiguration();

  if (!configValid) {
    console.error('❌ Mailgun configuration is invalid. Please check your .env file.');
    process.exit(1);
  }

  console.log('✅ Mailgun configuration is valid\n');

  // Test 2: Send test email
  const testEmail = process.argv[2];

  if (!testEmail) {
    console.log('Usage: npx ts-node src/scripts/testEmail.ts <recipient-email>');
    console.log('Example: npx ts-node src/scripts/testEmail.ts test@example.com');
    process.exit(0);
  }

  console.log(`Test 2: Sending test email to ${testEmail}...`);

  try {
    await sendFileShareNotification(testEmail);
    console.log('✅ Email sent successfully!');
    console.log('Check your inbox (including spam folder) for the notification.\n');
  } catch (error: any) {
    console.error('❌ Failed to send email:', error.message);
    process.exit(1);
  }

  console.log('=== Test Complete ===');
}

main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
