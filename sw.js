
const CACHE_NAME = "casa-romito-offline-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg"
];

const SUPABASE_SDK =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0";

// INSTALLAZIONE E MEMORIZZAZIONE DELL'APP
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    await cache.addAll(
      APP_FILES.map(file => new Request(
        new URL(file, self.registration.scope),
        { cache: "reload" }
      ))
    );

    // Prova a memorizzare anche la libreria Supabase.
    // Se non è raggiungibile, l'installazione continua.
    try {
      const response = await fetch(SUPABASE_SDK);

      if (response.ok || response.type === "opaque") {
        await cache.put(SUPABASE_SDK, response);
      }
    } catch (error) {
      console.log("Libreria Supabase non memorizzata:", error);
    }

    await self.skipWaiting();
  })());
});

// ATTIVAZIONE E PULIZIA DELLE VECCHIE CACHE
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();

    await Promise.all(
      names
        .filter(name =>
          name.startsWith("casa-romito-") &&
          name !== CACHE_NAME
        )
        .map(name => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

// GESTIONE DELLE RICHIESTE
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Libreria Supabase: cache prima, rete dopo.
  if (request.url === SUPABASE_SDK) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(SUPABASE_SDK);

      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response.ok || response.type === "opaque") {
          await cache.put(SUPABASE_SDK, response.clone());
        }

        return response;
      } catch (error) {
        return new Response(
          "Libreria Supabase non disponibile offline.",
          { status: 503 }
        );
      }
    })());

    return;
  }

  // Non memorizzare richieste API, autenticazione o dati privati.
  if (url.origin !== self.location.origin) return;

  // Navigazione: prova la rete e usa la pagina salvata se offline.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        const response = await fetch(request);

        if (response.ok) {
          await cache.put("./index.html", response.clone());
        }

        return response;
      } catch (error) {
        return (
          await cache.match(request) ||
          await cache.match("./index.html") ||
          await cache.match("./")
        );
      }
    })());

    return;
  }

  // Risorse locali: usa la cache e aggiorna quando possibile.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (cached) {
      fetch(request).then(response => {
        if (response.ok) {
          cache.put(request, response);
        }
      }).catch(() => {});

      return cached;
    }

    try {
      const response = await fetch(request);

      if (response.ok) {
        await cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      return new Response("Risorsa non disponibile offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});

// NOTIFICHE PUSH
self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      body: event.data ? event.data.text() : ""
    };
  }

  const title =
    data.title || "Casa Romito/Pindemonte";

  const options = {
    body: data.body || "È stato aggiunto un nuovo elemento.",

    icon: new URL(
      "./icon.svg",
      self.registration.scope
    ).href,

    badge: new URL(
      "./icon.svg",
      self.registration.scope
    ).href,

    tag: data.tag || "casa-notification",

    data: {
      url: data.url || "./"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// APERTURA DELL'APP TOCCANDO UNA NOTIFICA
self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || "./",
    self.registration.scope
  ).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of windows) {
      if (
        client.url.startsWith(self.registration.scope) &&
        "focus" in client
      ) {
        await client.focus();
        return;
      }
    }

    await self.clients.openWindow(targetUrl);
  })());
});
