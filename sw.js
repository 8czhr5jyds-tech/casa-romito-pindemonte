const CACHE_NAME = "casa-romito-offline-v7";
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

// Mostra le notifiche push inviate da Supabase all'altro membro della famiglia.
self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { body: event.data ? event.data.text() : "È stata aggiornata l'app di casa." };
  }

  const title = payload.title || "Casa Romito/Pindemonte";
  const options = {
    body: payload.body || "L'altro membro della famiglia ha modificato un elemento.",
    icon: "./icon.svg",
    badge: "./icon.svg",
    tag: payload.tag || "casa-romito-update",
    renotify: true,
    data: { url: payload.url || "./" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        if ("navigate" in client) await client.navigate(target);
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
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
      } catch (_) {
        return new Response("SDK non disponibile offline", { status: 503 });
      }
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(request, { cache: "reload" });
        if (fresh.ok) await cache.put("./index.html", fresh.clone());
        return fresh;
      } catch (_) {
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
      } catch (_) {
        return (await cache.match(request)) || Response.error();
      }
    })());
  }
});
