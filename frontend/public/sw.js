// Service worker: la app abre al instante aunque el servidor (Render, plan gratis) esté dormido.
// Regla que no se rompe: los datos de partidos NUNCA se sirven de caché sin intentar la red primero,
// porque un marcador viejo mostrado como actual es peor que una pantalla de carga.

const VERSION = "v1";
const SHELL = `shell-${VERSION}`; // HTML, CSS, JS: cambian solo al publicar
const DATOS = `datos-${VERSION}`; // respuestas de /api: copia de emergencia

// Lo mínimo para pintar la app sin red. Los assets con hash se agregan solos al usarse.
const BASE = ["/", "/index.html", "/favicon.svg", "/icono-192.png", "/manifest.webmanifest"];

// En vivo cambia cada minuto: una copia vieja confunde, así que no se guarda.
const SIN_CACHE = ["/api/envivo", "/api/partido"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Mensaje desde la página para forzar la versión nueva sin esperar a cerrar todas las pestañas
self.addEventListener("message", (e) => {
  if (e.data === "actualizar") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // escudos de ESPN y fuentes: los maneja el navegador

  // 1. Datos de partidos: red primero, caché solo si la red falla, y se avisa de la antigüedad.
  if (url.pathname.startsWith("/api/")) {
    if (SIN_CACHE.some((p) => url.pathname.startsWith(p))) return; // siempre red
    e.respondWith(redPrimero(request));
    return;
  }

  // 2. Navegación: la app se pinta al instante desde el shell guardado.
  if (request.mode === "navigate") {
    e.respondWith(redPrimero(request, "/index.html"));
    return;
  }

  // 3. Assets con hash en el nombre: si están en caché son los correctos, no cambian nunca.
  e.respondWith(cachePrimero(request));
});

async function redPrimero(request, alternativa = null) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const copia = res.clone();
      const cache = await caches.open(request.mode === "navigate" ? SHELL : DATOS);
      // la fecha permite a la página decir "datos de hace X minutos"
      cache.put(alternativa ?? request, copia);
    }
    return res;
  } catch {
    const guardada = await caches.match(alternativa ?? request);
    if (guardada) {
      // marca la respuesta para que la app sepa que viene de caché y lo diga
      const h = new Headers(guardada.headers);
      h.set("X-Desde-Cache", "1");
      return new Response(await guardada.blob(), { status: 200, headers: h });
    }
    throw new Error("Sin red y sin copia guardada");
  }
}

async function cachePrimero(request) {
  const guardada = await caches.match(request);
  if (guardada) return guardada;
  const res = await fetch(request);
  if (res.ok && new URL(request.url).pathname.startsWith("/assets/")) {
    const cache = await caches.open(SHELL);
    cache.put(request, res.clone());
  }
  return res;
}
