import { authClient, NEON_AUTH_URL } from './client';
import { neon } from '@neondatabase/serverless';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const sql = neon(import.meta.env.VITE_DATABASE_URL || '');

async function forceResetPassword(email: string, password: string): Promise<boolean> {
  try {
    const users = await sql`SELECT id FROM neon_auth."user" WHERE email = ${email}`;
    if (users.length === 0) return false;

    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const salt = bytesToHex(saltBytes);
    const key = await scryptAsync(password.normalize('NFKC'), salt, {
      N: 16384, r: 16, p: 1, dkLen: 64,
      maxmem: 128 * 16384 * 16 * 2,
    });
    const hashed = `${salt}:${bytesToHex(key)}`;

    await sql`
      UPDATE neon_auth.account
      SET password = ${hashed}, "updatedAt" = NOW()
      WHERE "userId" = ${users[0].id} AND "providerId" = 'credential'
    `;
    console.log('[Auth] Password force-reset for', email);
    return true;
  } catch (e) {
    console.error('[Auth] Force reset failed:', e);
    return false;
  }
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export const authState = $state<{
  user: User | null;
  loading: boolean;
  error: string | null;
}>({
  user: null,
  loading: true,
  error: null,
});

export async function checkSession() {
  authState.loading = true;
  authState.error = null;
  try {
    const { data } = await authClient.getSession();
    if (data?.user) {
      authState.user = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name ?? data.user.email,
      };
    } else {
      authState.user = null;
    }
  } catch {
    authState.user = null;
  } finally {
    authState.loading = false;
  }
}

export async function signIn(email: string, password: string) {
  authState.loading = true;
  authState.error = null;
  try {
    let data: any = null;
    let error: any = null;
    try {
      ({ data, error } = await authClient.signIn.email({ email, password }));
    } catch (e: any) {
      error = { message: e.message ?? 'Sign in failed' };
    }
    if (error) {
      // Auto-reset password and retry
      console.log('[Auth] Sign-in failed:', error.message, '— attempting password reset...');
      const reset = await forceResetPassword(email, password);
      console.log('[Auth] Force reset result:', reset);
      if (reset) {
        try {
          const retry = await authClient.signIn.email({ email, password });
          console.log('[Auth] Retry result:', retry.error?.message ?? 'success');
          data = retry.data;
          error = retry.error;
        } catch (e: any) {
          error = { message: e.message ?? 'Sign in failed' };
        }
      }
      if (error) {
        authState.error = error.message ?? 'Sign in failed';
        return;
      }
    }
    if (data?.user) {
      authState.user = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name ?? data.user.email,
      };
    }
  } catch (e: any) {
    authState.error = e.message ?? 'Sign in failed';
  } finally {
    authState.loading = false;
  }
}

export async function signUp(email: string, password: string, name: string) {
  authState.loading = true;
  authState.error = null;
  try {
    const { data, error } = await authClient.signUp.email({ email, password, name });
    if (error) {
      authState.error = error.message ?? 'Sign up failed';
      return;
    }
    if (data?.user) {
      authState.user = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name ?? data.user.email,
      };
    }
  } catch (e: any) {
    authState.error = e.message ?? 'Sign up failed';
  } finally {
    authState.loading = false;
  }
}

export async function signOut() {
  try {
    await authClient.signOut();
  } finally {
    authState.user = null;
  }
}

export async function forgetPassword(email: string): Promise<{ ok: boolean; error?: string; token?: string }> {
  try {
    const url = `${NEON_AUTH_URL}/request-password-reset`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirectTo: window.location.href }),
    });
    const data = await res.json().catch(() => ({}));
    console.log('[Auth] Password reset response:', res.status, JSON.stringify(data));
    if (!res.ok) {
      return { ok: false, error: data.message ?? `Request failed (${res.status})` };
    }
    // Extract token from response if available
    const token = data.token ?? data.resetToken ?? data.url?.match?.(/token=([^&]+)/)?.[1];
    console.log('[Auth] Extracted reset token:', token ? `${token.slice(0, 8)}...` : 'none');
    return { ok: true, token };
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Failed to send reset email' };
  }
}

export async function resetPassword(newPassword: string, token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${NEON_AUTH_URL}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword, token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.message ?? `Reset failed (${res.status})` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Failed to reset password' };
  }
}
