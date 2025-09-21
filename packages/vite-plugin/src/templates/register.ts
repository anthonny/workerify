// This template will be processed and have placeholders replaced
export const WORKERIFY_SW_URL = '__SW_URL__';
export const WORKERIFY_SCOPE = '__SCOPE__';

export async function registerWorkerifySW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Workerify] Service Worker not supported');
    return null;
  }

  console.log('[Workerify] Cleaning up existing service workers...');

  // First, get all existing registrations
  const existingRegistrations =
    await navigator.serviceWorker.getRegistrations();
  console.log(
    '[Workerify] Found',
    existingRegistrations.length,
    'existing service worker(s)',
  );

  // Unregister any existing workerify service workers
  for (const registration of existingRegistrations) {
    if (
      registration.scope.includes(WORKERIFY_SCOPE) ||
      registration.active?.scriptURL?.includes('__SW_FILENAME__')
    ) {
      console.log(
        '[Workerify] Unregistering old workerify SW:',
        registration.scope,
      );
      await registration.unregister();
    }
  }

  console.log('[Workerify] Registering new service worker...');
  console.log('[Workerify] SW URL:', WORKERIFY_SW_URL);
  console.log('[Workerify] SW Scope from plugin:', WORKERIFY_SCOPE);
  console.log('[Workerify] Current page URL:', window.location.href);
  console.log(
    '[Workerify] Expected full scope URL:',
    window.location.origin + WORKERIFY_SCOPE,
  );

  // Register the new service worker
  const reg = await navigator.serviceWorker.register(WORKERIFY_SW_URL, {
    scope: WORKERIFY_SCOPE,
    updateViaCache: 'none', // Always fetch fresh SW script
  });

  console.log('[Workerify] Registration successful');
  console.log('[Workerify] Actual registered scope:', reg.scope);
  console.log(
    '[Workerify] Current controller:',
    !!navigator.serviceWorker.controller,
  );
  console.log(
    '[Workerify] Registration state:',
    reg.installing?.state,
    reg.waiting?.state,
    reg.active?.state,
  );

  if (!navigator.serviceWorker.controller) {
    console.log('[Workerify] Waiting for service worker to take control...');

    // Wait for the service worker to be ready and controlling
    await new Promise<void>((resolve) => {
      let resolved = false;

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };

      // Check if SW becomes active quickly
      const checkActive = () => {
        if (navigator.serviceWorker.controller) {
          console.log('[Workerify] Service worker is now controlling');
          cleanup();
        }
      };

      // Listen for controller change
      const onControllerChange = () => {
        console.log('[Workerify] Controller changed');
        checkActive();
      };

      navigator.serviceWorker.addEventListener(
        'controllerchange',
        onControllerChange,
      );

      // Timeout fallback
      const timeout = setTimeout(() => {
        console.warn(
          '[Workerify] Service worker control timeout, continuing anyway',
        );
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          onControllerChange,
        );
        cleanup();
      }, 2000); // Reduced timeout

      // Try to activate immediately if there's a waiting SW
      if (reg.waiting) {
        console.log('[Workerify] Activating waiting service worker');
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // Check immediately in case it's already controlling
      setTimeout(checkActive, 100);

      // Override resolve to ensure cleanup
      const originalResolve = resolve;
      resolve = () => {
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          onControllerChange,
        );
        originalResolve();
      };
    });
    console.log('[Workerify] Service worker setup complete');
  } else {
    console.log('[Workerify] Service worker already controlling');
  }

  // Final verification
  console.log('[Workerify] Final check:');
  console.log(
    '[Workerify] - Controller exists:',
    !!navigator.serviceWorker.controller,
  );
  console.log('[Workerify] - Registration scope:', reg.scope);
  console.log('[Workerify] - Registration active:', !!reg.active);
  console.log('[Workerify] - Page URL:', window.location.href);
  console.log(
    '[Workerify] - Page is in scope?',
    window.location.href.startsWith(reg.scope),
  );

  return reg;
}
