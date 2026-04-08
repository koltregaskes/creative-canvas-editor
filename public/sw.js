self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // This first version is intentionally lightweight. We only register the worker
  // so the app is installable as a PWA without adding brittle offline behavior yet.
})
