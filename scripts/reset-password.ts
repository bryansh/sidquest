/**
 * Reset a user's password directly in the database.
 * Uses the same scrypt params as Better Auth.
 *
 * Usage: npx tsx scripts/reset-password.ts <email> <new-password>
 */
import { neon } from '@neondatabase/serverless';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import 'dotenv/config';

const [, , email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.error('Usage: npx tsx scripts/reset-password.ts <email> <new-password>');
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

// Better Auth scrypt config
const config = { N: 16384, r: 16, p: 1, dkLen: 64 };

// Generate salt + hash matching Better Auth's format
const saltBytes = crypto.getRandomValues(new Uint8Array(16));
const salt = bytesToHex(saltBytes);
const key = await scryptAsync(newPassword.normalize('NFKC'), salt, {
  N: config.N, r: config.r, p: config.p, dkLen: config.dkLen,
  maxmem: 128 * config.N * config.r * 2,
});
const hashed = `${salt}:${bytesToHex(key)}`;

const sql = neon(process.env.VITE_DATABASE_URL!);

// Find user
const users = await sql`SELECT id, email, name FROM neon_auth."user" WHERE email = ${email}`;
if (users.length === 0) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

const user = users[0];
console.log(`Found user: ${user.name} (${user.email})`);

// Update account password
await sql`
  UPDATE neon_auth.account
  SET password = ${hashed}, "updatedAt" = NOW()
  WHERE "userId" = ${user.id} AND "providerId" = 'credential'
`;

console.log(`Password reset successfully for ${email}`);
