export function invalidateCatalogCache() {
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('api_cache_v1:filter:')) {
        localStorage.removeItem(k);
      }
    });
  } catch {}

  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'PURGE_API', match: '/api/device' });
    navigator.serviceWorker.controller.postMessage({ type: 'PURGE_API', match: '/api/device/filter' });
  }
}
