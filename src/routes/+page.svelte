<script lang="ts">
  import TitleBar from '$lib/components/layout/TitleBar.svelte';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import MainPanel from '$lib/components/layout/MainPanel.svelte';
</script>

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
