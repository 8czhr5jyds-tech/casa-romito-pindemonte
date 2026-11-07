
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
