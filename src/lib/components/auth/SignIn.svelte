<script lang="ts">
  import { authState, signIn, signUp } from '$lib/auth/authState.svelte';

  let mode: 'signin' | 'signup' = $state('signin');
  let email = $state('');
  let password = $state('');
  let name = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (mode === 'signup') {
      await signUp(email, password, name);
    } else {
      await signIn(email, password);
    }
  }
</script>

<div class="flex items-center justify-center h-screen w-screen bg-[var(--color-bg)]">
  <div class="w-full max-w-sm p-6 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
    <h1 class="text-xl font-bold mb-1">Lorekeeper</h1>
    <p class="text-sm text-[var(--color-text-muted)] mb-6">
      {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
    </p>

    {#if authState.error}
      <div class="mb-4 p-3 rounded bg-red-900/30 border border-red-800 text-red-300 text-sm">
        {authState.error}
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
        required
        class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />
      <input
        type="password"
        placeholder="Password"
        bind:value={password}
        required
        minlength="8"
        class="px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />
      <button
        type="submit"
        disabled={authState.loading}
        class="px-3 py-2 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        {authState.loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
      </button>
    </form>

    <p class="mt-4 text-center text-xs text-[var(--color-text-muted)]">
      {#if mode === 'signin'}
        Don't have an account?
        <button onclick={() => { mode = 'signup'; authState.error = null; }} class="text-[var(--color-accent)] hover:underline">Sign up</button>
      {:else}
        Already have an account?
        <button onclick={() => { mode = 'signin'; authState.error = null; }} class="text-[var(--color-accent)] hover:underline">Sign in</button>
      {/if}
    </p>
  </div>
</div>
