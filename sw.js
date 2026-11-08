
const CACHE_NAME = "casa-romito-offline-v3";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg"
];

const SUPABASE_SDK =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0";

// INSTALLAZIONE: PRECARICA I FILE AGGIORNATI
self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await cache.addAll(APP_FILES);

      try {
        const response = await fetch(SUPABASE_SDK, {
          mode: "cors",
          cache: "no-cache"
        });

        if (response.ok) {
          await cache.put(SUPABASE_SDK, response);
        }
      } catch (error) {
        console.log("SDK non disponibile durante l'installazione");
      }

      await self.skipWaiting();
    })()
  );
});

// ATTIVAZIONE: ELIMINA LE VECCHIE CACHE
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(
            key =>
              key.startsWith("casa-romito-") &&
              key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

// GESTIONE DELLE RICHIESTE
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // NON INTERCETTARE LE RICHIESTE PRIVATE DI SUPABASE
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.includes("/rest/v1/") ||
    url.pathname.includes("/auth/v1/") ||
    url.pathname.includes("/storage/v1/")
  ) {
    return;
  }

  // SDK SUPABASE: CACHE PRIMA, RETE COME RISERVA
  if (request.url === SUPABASE_SDK) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(SUPABASE_SDK);

        if (cached) return cached;

        return fetch(request);
      })()
    );
    return;
  }

  // NAVIGAZIONE: RETE PRIMA, CACHE SOLO SE OFFLINE
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request, {
            cache: "no-cache"
          });

          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put("./index.html", response.clone());
          }

          return response;
        } catch (error) {
          const cache = await caches.open(CACHE_NAME);

          return (
            await cache.match("./index.html") ||
            await cache.match("./") ||
            new Response("App non disponibile offline", {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8"
              }
            })
          );
        }
      })()
    );
    return;
  }

  // FILE LOCALI: RETE PRIMA, CACHE COME RISERVA
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);

        try {
          const response = await fetch(request, {
            cache: "no-cache"
          });

          if (response.ok) {
            await cache.put(request, response.clone());
          }

          return response;
        } catch (error) {
          const cached = await cache.match(request);

          return (
            cached ||
            new Response("Contenuto non disponibile offline", {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8"
              }
            })
          );
        }
      })()
    );
  }
});
