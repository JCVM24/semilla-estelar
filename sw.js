// =====================================================================
// Semilla Estelar · Service worker
// Funciona sin conexión, recibe las notificaciones push y atiende sus botones.
// Cambia VERSION cada vez que publiques cambios para forzar la actualización.
// =====================================================================
importScripts("./config.js");

const VERSION = "semilla-v2";
const SHELL = [
  "./",
  "./index.html",
  "./config.js",
  "./supabase.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./badge-96.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Páginas: primero la red (para recibir actualizaciones); sin red, la copia guardada
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("./index.html", copy)); return res; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  // Archivos propios y fuentes de Google: copia guardada y se actualiza en segundo plano
  const sameOrigin = url.origin === self.location.origin;
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !fonts) return; // API de Supabase: siempre en vivo
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => { if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
        .catch(() => hit);
      return hit || net;
    })
  );
});

// ---------- Notificaciones push ----------
self.addEventListener("push", (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { p = { title: "Semilla Estelar", body: e.data ? e.data.text() : "" }; }
  const d = p.data || {};
  const actions = d.mid && d.token
    ? [{ action: "complete", title: "Completar" }, { action: "snooze", title: "Posponer 10 min" }]
    : [];
  e.waitUntil(
    self.registration.showNotification(p.title || "Semilla Estelar", {
      body: p.body || "",
      tag: p.tag,
      renotify: true,
      icon: "./icon-192.png",
      badge: "./badge-96.png",
      vibrate: [200, 100, 200],
      data: d,
      actions,
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  const n = e.notification;
  const d = n.data || {};
  n.close();

  if (e.action === "snooze") {
    e.waitUntil(
      fetch(self.SUPABASE_URL + "/functions/v1/snooze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uid: d.uid, mid: d.mid, day: d.day, token: d.token, title: d.title, minutes: 10 }),
      })
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); })
        .catch(() => self.registration.showNotification("No se pudo posponer", {
          body: "Revisa tu conexión. Abre la app para completar la misión.",
          icon: "./icon-192.png", badge: "./badge-96.png", tag: "snooze-error",
        }))
    );
    return;
  }

  const wantsComplete = e.action === "complete" && d.mid;
  const target = new URL(wantsComplete ? `./?complete=${encodeURIComponent(d.mid)}&day=${encodeURIComponent(d.day || "")}` : "./", self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const win = wins.find((w) => w.url.startsWith(self.registration.scope));
    if (win) {
      if (wantsComplete) win.postMessage({ type: "complete", mid: d.mid, day: d.day });
      return win.focus();
    }
    return self.clients.openWindow(target);
  })());
});
