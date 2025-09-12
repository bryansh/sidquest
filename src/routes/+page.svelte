<script>
  import { invoke } from '@tauri-apps/api/core'
  
  let greeting = ''
  let name = ''
  
  async function greet() {
    greeting = await invoke('greet', { name })
  }
</script>

<div class="container mx-auto p-8 space-y-8">
  <h1 class="h1 text-center">Welcome to Tauri + Svelte!</h1>
  
  <div class="card p-4 text-center space-y-4">
    <div class="input-group">
      <input 
        class="input"
        bind:value={name} 
        placeholder="Enter your name"
        on:keydown={(e) => e.key === 'Enter' && greet()}
      />
      <button class="btn variant-filled" on:click={greet}>Greet</button>
    </div>
    
    {#if greeting}
      <p class="text-lg font-bold">{greeting}</p>
    {/if}
  </div>
</div>