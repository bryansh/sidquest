<script lang="ts">
  import { onMount } from 'svelte';
  import { authState, checkSession } from '$lib/auth/authState.svelte';
  import SignIn from '$lib/components/auth/SignIn.svelte';
  import TitleBar from '$lib/components/layout/TitleBar.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import MainPanel from '$lib/components/layout/MainPanel.svelte';

  onMount(() => {
    checkSession();
  });
</script>

{#if authState.loading}
  <div class="flex items-center justify-center h-screen w-screen bg-[var(--color-bg)]">
    <p class="text-[var(--color-text-muted)]">Loading...</p>
  </div>
{:else if !authState.user}
  <SignIn />
{:else}
  <div class="flex flex-col h-screen w-screen bg-[var(--color-bg)] rounded-lg overflow-hidden border border-[var(--color-border)]">
    <TitleBar />
    <div class="flex flex-1 overflow-hidden">
      <Sidebar
        onNewEntityType={() => {/* TODO */}}
        onNewEntity={(typeId) => {/* TODO */}}
      />
      <MainPanel />
    </div>
  </div>
{/if}
