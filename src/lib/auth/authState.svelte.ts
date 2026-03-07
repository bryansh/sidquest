import { authClient } from './client';

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
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error) {
      authState.error = error.message ?? 'Sign in failed';
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
