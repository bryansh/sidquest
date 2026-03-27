<script lang="ts">
  import { authState, signIn, signUp } from '$lib/auth/authState.svelte';
  import { LazyStore } from '@tauri-apps/plugin-store';

  const store = new LazyStore('auth.json');

  let mode: 'signin' | 'signup' = $state('signin');
  let email = $state('');
  let password = $state('');
  let name = $state('');
  let message = $state('');

  let emailEl = $state<HTMLInputElement | null>(null);
  let passwordEl = $state<HTMLInputElement | null>(null);

  // Restore last used email and focus the right field
  store.get<string>('lastEmail').then((saved) => {
    if (saved && !email) {
      email = saved;
      requestAnimationFrame(() => passwordEl?.focus());
    } else {
      requestAnimationFrame(() => emailEl?.focus());
    }
  });

  async function saveEmail() {
    await store.set('lastEmail', email);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    message = '';
    if (mode === 'signup') {
      await saveEmail();
      await signUp(email, password, name);
    } else {
      await saveEmail();
      await signIn(email, password);
    }
  }

  function switchMode(newMode: 'signin' | 'signup') {
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
      {:else}
        Create your account
      {/if}
    </p>

    {#if authState.error}
      <div class="mb-4 p-3 rounded bg-red-900/30 border border-red-800 text-red-300 text-sm">
        {authState.error}
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

      <input
        type="email"
        placeholder="Email"
        bind:value={email}
        bind:this={emailEl}
        required
        class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />

      <input
        type="password"
        placeholder="Password"
        bind:value={password}
        bind:this={passwordEl}
        required
        minlength="8"
        class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />

      <button
        type="submit"
        disabled={authState.loading}
        class="px-3 py-2 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        {#if authState.loading}
          Please wait...
        {:else if mode === 'signin'}
          Sign In
        {:else}
          Sign Up
        {/if}
      </button>
    </form>

    <p class="mt-4 text-center text-xs text-[var(--color-text-muted)]">
      {#if mode === 'signin'}
        <button onclick={() => switchMode('signup')} class="text-[var(--color-accent)] hover:underline cursor-pointer">Sign up</button>
      {:else}
        Already have an account?
        <button onclick={() => switchMode('signin')} class="text-[var(--color-accent)] hover:underline cursor-pointer">Sign in</button>
      {/if}
    </p>
  </div>
</div>
