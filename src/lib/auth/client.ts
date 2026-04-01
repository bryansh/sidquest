import { createAuthClient } from '@neondatabase/neon-js/auth';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL;

// Better Auth validates the Origin header for CSRF protection.
// In Tauri production builds the origin is "tauri://localhost" which Neon Auth
// doesn't recognize. The Neon auth adapter hardcodes calls to the global fetch,
// so we intercept it: requests to the auth URL go through Tauri's HTTP plugin
// (Rust reqwest, no webview Origin header), everything else uses native fetch.
const nativeFetch = globalThis.fetch;
const neonHost = new URL(NEON_AUTH_URL).host;

globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
	if (url.includes(neonHost)) {
		return (tauriFetch as unknown as typeof globalThis.fetch)(input, init);
	}
	return nativeFetch(input, init);
};

export const authClient = createAuthClient(NEON_AUTH_URL);
