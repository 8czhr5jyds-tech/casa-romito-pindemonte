const CACHE_NAME = "casa-romito-offline-v5";
const APP_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];
const SUPABASE_SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0";

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES);
    try {
      const response = await fetch(SUPABASE_SDK, { cache: "no-cache" });
      if (response.ok) await cache.put(SUPABASE_SDK, response);
    } catch (error) {
      console.warn("Supabase SDK non disponibile durante il precache:", error);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("casa-romito-") && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.hostname.endsWith("supabase.co") || url.hostname.includes("supabase")) return;

  if (request.url === SUPABASE_SDK) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh.ok) await cache.put(request, fresh.clone());
        return fresh;
      } catch (error) {
        return new Response("SDK non disponibile offline", { status: 503 });
      }
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(request, { cache: "no-cache" });
        if (fresh.ok) await cache.put("./index.html", fresh.clone());
        return fresh;
      } catch (error) {
        return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(request, { cache: "no-cache" });
        if (fresh.ok) await cache.put(request, fresh.clone());
        return fresh;
      } catch (error) {
        return (await cache.match(request)) || Response.error();
      }
    })());
  }
});
