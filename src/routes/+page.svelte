<script>
  import { invoke } from '@tauri-apps/api/core'
  
  let greeting = ''
  let name = ''
  
  async function greet() {
    greeting = await invoke('greet', { name })
  }
</script>

<main>
  <h1>Welcome to Tauri + Svelte!</h1>
  
  <div class="input-group">
    <input 
      bind:value={name} 
      placeholder="Enter your name"
      on:keydown={(e) => e.key === 'Enter' && greet()}
    />
    <button on:click={greet}>Greet</button>
  </div>
  
  {#if greeting}
    <p class="greeting">{greeting}</p>
  {/if}
</main>

<style>
  main {
    max-width: 600px;
    margin: 50px auto;
    padding: 20px;
    text-align: center;
  }
  
  h1 {
    color: #ff3e00;
  }
  
  .input-group {
    margin: 30px 0;
  }
  
  input {
    padding: 10px;
    margin-right: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 16px;
  }
  
  button {
    padding: 10px 20px;
    background-color: #ff3e00;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
  }
  
  button:hover {
    background-color: #ff5722;
  }
  
  .greeting {
    margin-top: 20px;
    font-size: 18px;
    color: #333;
    font-weight: bold;
  }
</style>