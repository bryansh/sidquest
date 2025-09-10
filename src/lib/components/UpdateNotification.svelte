<script>
  import { onMount } from 'svelte';
  import { check } from '@tauri-apps/plugin-updater';
  import { relaunch } from '@tauri-apps/plugin-process';
  import { info, error, debug } from '@tauri-apps/plugin-log';

  let updateState = $state('');
  let showNotification = $state(false);
  let update = $state(null);
  let errorMessage = $state('');
  let autoHideTimer = $state(null);
  let downloadProgress = $state(0);

  onMount(() => {
    checkForUpdates();
  });

  async function checkForUpdates() {
    try {
      info('SidQuest: Checking for updates...');
      update = await check();
      
      if (update?.available) {
        info(`SidQuest: Update available - version ${update.version}`);
        updateState = 'available';
        showNotification = true;
      } else {
        info('SidQuest: No updates available');
      }
    } catch (err) {
      error(`SidQuest: Failed to check for updates - ${err.message || err}`);
      console.error('Failed to check for updates - Full error:', err);
      updateState = 'error';
      errorMessage = err.message || 'Failed to check for updates';
      showNotification = true;
      startAutoHide();
    }
  }

  async function installUpdate() {
    if (!update) return;

    try {
      info(`SidQuest: Starting update installation to version ${update.version}`);
      debug(`SidQuest: Update details - version: ${update.version}, current: ${update.currentVersion}`);
      
      updateState = 'installing';
      
      info('SidQuest: Downloading and installing update...');
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          info(`SidQuest: Download started, size: ${event.data.contentLength} bytes`);
        } else if (event.event === 'Progress') {
          downloadProgress = (event.data.chunkLength / event.data.contentLength) * 100;
          if (downloadProgress % 10 < 1) {
            info(`SidQuest: Download progress: ${downloadProgress.toFixed(0)}%`);
          }
        } else if (event.event === 'Finished') {
          info('SidQuest: Download completed, installing...');
        }
      });
      
      info('SidQuest: Update installed successfully');
      updateState = 'complete';
      startAutoHide();
      
      info('SidQuest: Restarting application in 3 seconds...');
      setTimeout(() => {
        info('SidQuest: Relaunching application...');
        relaunch();
      }, 3000);
    } catch (err) {
      error(`SidQuest: Failed to install update - ${err.message || err}`);
      error(`SidQuest: Error type: ${err?.constructor?.name}`);
      if (err?.stack) {
        debug(`SidQuest: Error stack: ${err.stack}`);
      }
      
      console.error('Failed to install update - Full error:', err);
      
      updateState = 'error';
      errorMessage = err?.message || 'Failed to install update';
      showNotification = true;
      startAutoHide();
    }
  }

  function dismissNotification() {
    showNotification = false;
    clearAutoHide();
  }

  function startAutoHide() {
    clearAutoHide();
    autoHideTimer = setTimeout(() => {
      showNotification = false;
    }, 5000);
  }

  function clearAutoHide() {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
  }

  $effect(() => {
    return () => clearAutoHide();
  });
</script>

{#if showNotification}
  <div class="update-notification">
    <div class="notification-content">
      <div class="notification-header">
        <div class="notification-message">
          {#if updateState === 'available'}
            <h3>🚀 SidQuest Update Available</h3>
            <p>Version {update.version} is ready to install.</p>
          {:else if updateState === 'installing'}
            <h3>📦 Installing Update</h3>
            <p>
              {#if downloadProgress > 0}
                Downloading... {downloadProgress.toFixed(0)}%
              {:else}
                Preparing download...
              {/if}
            </p>
            <div class="progress-bar">
              <div class="progress-fill" style="width: {downloadProgress}%"></div>
            </div>
          {:else if updateState === 'complete'}
            <h3>✅ Update Complete</h3>
            <p>Restarting SidQuest...</p>
          {:else if updateState === 'error'}
            <h3>❌ Update Error</h3>
            <p>{errorMessage}</p>
          {/if}
        </div>
        
        <button onclick={dismissNotification} class="dismiss-button" aria-label="Dismiss notification">
          ✕
        </button>
      </div>
      
      {#if updateState === 'available'}
        <div class="notification-actions">
          <button onclick={installUpdate} class="action-button primary">
            Install Now
          </button>
          <button onclick={dismissNotification} class="action-button secondary">
            Later
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .update-notification {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 9999;
    max-width: 24rem;
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .notification-content {
    padding: 1rem;
  }

  .notification-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .notification-message {
    flex: 1;
    margin-right: 0.75rem;
  }

  .notification-message h3 {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
  }

  .notification-message p {
    font-size: 0.875rem;
    color: #666;
    margin: 0;
  }

  .progress-bar {
    margin-top: 0.5rem;
    width: 100%;
    height: 0.5rem;
    background: #e5e5e5;
    border-radius: 0.25rem;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #ff3e00;
    border-radius: 0.25rem;
    transition: width 0.3s ease;
  }

  .dismiss-button {
    background: none;
    border: none;
    color: #999;
    cursor: pointer;
    font-size: 1.25rem;
    padding: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dismiss-button:hover {
    color: #666;
  }

  .notification-actions {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.5rem;
  }

  .action-button {
    flex: 1;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .action-button.primary {
    background: #ff3e00;
    color: white;
  }

  .action-button.primary:hover {
    background: #e63600;
  }

  .action-button.secondary {
    background: #f5f5f5;
    color: #333;
  }

  .action-button.secondary:hover {
    background: #e5e5e5;
  }
</style>