<script>
  import { onMount } from 'svelte'
  import { register } from '@tauri-apps/plugin-global-shortcut'
  
  let noteText = ''
  let textareaElement
  
  onMount(async () => {
    // Focus the textarea on load
    if (textareaElement) {
      textareaElement.focus()
    }
    
    // Register global shortcut
    try {
      await register('CommandOrControl+Alt+N', async () => {
        console.log('Global shortcut triggered!')
        
        // Import window functions dynamically  
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const window = getCurrentWindow()
        
        // Show and focus the window
        await window.show()
        await window.setFocus()
        console.log('Window shown and focused')
        
        // Focus the textarea after a small delay to ensure window is ready
        setTimeout(() => {
          if (textareaElement) {
            textareaElement.focus()
            console.log('Textarea focused from global shortcut')
          }
        }, 100)
      })
      console.log('Global shortcut registered: CommandOrControl+Alt+N')
    } catch (error) {
      console.error('Failed to register global shortcut:', error)
    }
    
    // Add local keyboard shortcut listener (for when app is focused)
    const handleKeydown = (event) => {
      // Check for Cmd+Option+N on Mac (or Ctrl+Alt+N on other platforms)
      if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === 'KeyN') {
        event.preventDefault()
        if (textareaElement) {
          textareaElement.focus()
        }
      }
    }
    
    document.addEventListener('keydown', handleKeydown)
    
    // Load saved notes from localStorage
    const saved = localStorage.getItem('sidquest-notes')
    if (saved) {
      noteText = saved
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeydown)
    }
  })
  
  // Auto-save notes to localStorage
  $: if (typeof window !== 'undefined') {
    localStorage.setItem('sidquest-notes', noteText)
  }
</script>

<div class="container mx-auto p-8 h-screen flex flex-col">
  <div class="mb-6">
    <h1 class="h2 text-center mb-2">SidQuest Notes</h1>
    <p class="text-center text-sm opacity-60">Press ⌘⌥N to show and focus the text area (works globally)</p>
  </div>
  
  <div class="flex-1 flex flex-col">
    <textarea
      bind:this={textareaElement}
      bind:value={noteText}
      class="textarea flex-1 resize-none text-base leading-relaxed"
      placeholder="Start typing your notes here..."
      spellcheck="false"
    ></textarea>
  </div>
  
  <div class="mt-4 text-center text-xs opacity-50">
    {noteText.length} characters
  </div>
</div>