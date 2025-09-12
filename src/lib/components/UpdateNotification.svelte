<script>
  import { onMount } from 'svelte';
  import { check } from '@tauri-apps/plugin-updater';
  import { relaunch } from '@tauri-apps/plugin-process';
  import { info, error, debug } from '@tauri-apps/plugin-log';
  import { Modal } from '@skeletonlabs/skeleton-svelte';

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

<Modal 
  open={showNotification}
  onOpenChange={(e) => (showNotification = e.open)}
  contentBase="card bg-surface-100-900 p-6 space-y-4 shadow-xl max-w-md mx-4"
>
  {#snippet content()}
    <div class="space-y-4">
      <h3 class="text-lg font-semibold">
        {#if updateState === 'available'}
          🚀 SidQuest Update Available
        {:else if updateState === 'installing'}
          📦 Installing Update
        {:else if updateState === 'complete'}
          ✅ Update Complete
        {:else if updateState === 'error'}
          ❌ Update Error
        {/if}
      </h3>

      <div>
        {#if updateState === 'available'}
          <p>Version {update.version} is ready to install.</p>
        {:else if updateState === 'installing'}
          <div class="space-y-2">
            <p>
              {#if downloadProgress > 0}
                Downloading... {downloadProgress.toFixed(0)}%
              {:else}
                Preparing download...
              {/if}
            </p>
            <div class="bg-surface-400 w-full h-3 rounded-full">
              <div class="bg-primary-500 h-full rounded-full transition-all duration-300" style="width: {downloadProgress}%"></div>
            </div>
          </div>
        {:else if updateState === 'complete'}
          <p>Restarting SidQuest...</p>
        {:else if updateState === 'error'}
          <p class="text-error-500">{errorMessage}</p>
        {/if}
      </div>

      {#if updateState === 'available'}
        <div class="flex gap-2">
          <button onclick={installUpdate} class="btn variant-filled flex-1">
            Install Now
          </button>
          <button onclick={dismissNotification} class="btn variant-soft flex-1">
            Later
          </button>
        </div>
      {:else if updateState === 'error'}
        <div class="flex justify-end">
          <button onclick={dismissNotification} class="btn variant-filled">
            Close
          </button>
        </div>
      {/if}
    </div>
  {/snippet}
</Modal>