<script lang="ts">
  import { authState, signIn, signUp, forgetPassword, resetPassword } from '$lib/auth/authState.svelte';

  let mode: 'signin' | 'signup' | 'forgot' | 'reset' = $state('signin');
  let email = $state('');
  let password = $state('');
  let name = $state('');
  let token = $state('');
  let newPassword = $state('');
  let message = $state('');
  let error = $state('');
  let busy = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    message = '';
    error = '';
    if (mode === 'signup') {
      await signUp(email, password, name);
    } else if (mode === 'forgot') {
      busy = true;
      const result = await forgetPassword(email);
      busy = false;
      if (result.ok) {
        message = 'Check your email for a reset link. Copy the token from the URL and paste it below.';
        mode = 'reset';
      } else {
        error = result.error ?? 'Failed to send reset email';
      }
    } else if (mode === 'reset') {
      busy = true;
      const result = await resetPassword(newPassword, token);
      busy = false;
      if (result.ok) {
        message = 'Password reset successfully. You can now sign in.';
        mode = 'signin';
        password = '';
        token = '';
        newPassword = '';
      } else {
        error = result.error ?? 'Failed to reset password';
      }
    } else {
      await signIn(email, password);
    }
  }

  function switchMode(newMode: 'signin' | 'signup' | 'forgot' | 'reset') {
    mode = newMode;
    authState.error = null;
    message = '';
  }
</script>

<div class="flex items-center justify-center h-screen w-screen bg-[var(--color-bg)]">
  <div class="w-full max-w-sm p-6 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
    <h1 class="text-xl font-bold mb-1">Sidquest</h1>
    <p class="text-sm text-[var(--color-text-muted)] mb-6">
      {#if mode === 'signin'}
        Sign in to continue
      {:else if mode === 'signup'}
        Create your account
      {:else if mode === 'forgot'}
        Enter your email to receive a reset link
      {:else}
        Paste the token from your reset email
      {/if}
    </p>

    {#if authState.error || error}
      <div class="mb-4 p-3 rounded bg-red-900/30 border border-red-800 text-red-300 text-sm">
        {authState.error || error}
      </div>
    {/if}

    {#if message}
      <div class="mb-4 p-3 rounded bg-green-900/30 border border-green-800 text-green-300 text-sm">
        {message}
      </div>
    {/if}

    <form onsubmit={handleSubmit} class="flex flex-col gap-3">
      {#if mode === 'signup'}
        <input
          type="text"
          placeholder="Name"
          bind:value={name}
          required
          class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      {/if}

      {#if mode === 'signin' || mode === 'signup' || mode === 'forgot'}
        <input
          type="email"
          placeholder="Email"
          bind:value={email}
          required
          class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      {/if}

      {#if mode === 'signin' || mode === 'signup'}
        <input
          type="password"
          placeholder="Password"
          bind:value={password}
          required
          minlength="8"
          class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      {/if}

      {#if mode === 'reset'}
        <input
          type="text"
          placeholder="Token from reset email"
          bind:value={token}
          required
          class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
        <input
          type="password"
          placeholder="New password"
          bind:value={newPassword}
          required
          minlength="8"
          class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      {/if}

      <button
        type="submit"
        disabled={authState.loading || busy}
        class="px-3 py-2 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        {#if authState.loading || busy}
          Please wait...
        {:else if mode === 'signin'}
          Sign In
        {:else if mode === 'signup'}
          Sign Up
        {:else if mode === 'forgot'}
          Send Reset Email
        {:else}
          Reset Password
        {/if}
      </button>
    </form>

    <p class="mt-4 text-center text-xs text-[var(--color-text-muted)]">
      {#if mode === 'signin'}
        <button onclick={() => switchMode('forgot')} class="text-[var(--color-accent)] hover:underline cursor-pointer">Forgot password?</button>
        <span class="mx-1">&middot;</span>
        <button onclick={() => switchMode('signup')} class="text-[var(--color-accent)] hover:underline cursor-pointer">Sign up</button>
      {:else if mode === 'signup'}
        Already have an account?
        <button onclick={() => switchMode('signin')} class="text-[var(--color-accent)] hover:underline cursor-pointer">Sign in</button>
      {:else}
        <button onclick={() => switchMode('signin')} class="text-[var(--color-accent)] hover:underline cursor-pointer">Back to sign in</button>
      {/if}
    </p>
  </div>
</div>
