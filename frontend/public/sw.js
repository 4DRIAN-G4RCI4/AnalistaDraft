// Service worker: la app abre al instante aunque el servidor (Render, plan gratis) esté dormido.
//
// Dos reglas que no se rompen:
// 1. Los datos de partidos NUNCA salen de caché sin intentar la red primero: un marcador viejo
//    mostrado como actual es peor que una pantalla de carga.
// 2. El HTML guardado solo se sirve si su JS sigue existiendo. Si no, es mejor fallar con un
//    error de red (que el navegador sabe mostrar) que pintar una página en blanco.

const VERSION = "v2";
const SHELL = `shell-${VERSION}`; // HTML, CSS, JS: cambian solo al publicar
const DATOS = `datos-${VERSION}`; // respuestas de /api: copia de emergencia

const BASE = ["/", "/index.html", "/favicon.svg", "/icono-192.png", "/manifest.webmanifest"];

// En vivo cambia cada minuto: una copia vieja confunde, así que no se guarda.
const SIN_CACHE = ["/api/envivo", "/api/partido"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      // si un archivo falla no se cae toda la instalación
      .then((c) => Promise.allSettled(BASE.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "actualizar") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // escudos de ESPN y fuentes: los maneja el navegador

  if (url.pathname.startsWith("/api/")) {
    if (SIN_CACHE.some((p) => url.pathname.startsWith(p))) return; // siempre red
    e.respondWith(datos(request));
    return;
  }

  if (request.mode === "navigate") {
    e.respondWith(navegacion(request));
    return;
  }

  e.respondWith(asset(request));
});

// Red primero; si falla, la última copia buena, marcada para que la app avise de su antigüedad.
async function datos(request) {
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(DATOS)).put(request, res.clone());
    return res;
  } catch {
    const guardada = await caches.match(request);
    if (!guardada) throw new Error("Sin red y sin copia guardada");
    const h = new Headers(guardada.headers);
    h.set("X-Desde-Cache", "1");
    return new Response(await guardada.blob(), { status: 200, headers: h });
  }
}

// La página. Se guarda la versión nueva en cada visita; la copia solo entra si es utilizable.
async function navegacion(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const copia = res.clone();
      const cache = await caches.open(SHELL);
      await cache.put("/index.html", copia);
      // los assets que pide esta versión se guardan ya, para que la copia nunca quede coja
      guardarAssetsDe(res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const guardada = await caches.match("/index.html");
    // un HTML viejo que pide un JS borrado deja la pantalla en blanco: preferimos el error de red
    if (guardada && (await assetsPresentes(guardada.clone()))) return guardada;
    throw new Error("Sin red y sin copia utilizable");
  }
}

// Los assets llevan hash en el nombre: si están guardados son los correctos.
async function asset(request) {
  const guardada = await caches.match(request);
  if (guardada) return guardada;
  const res = await fetch(request);
  if (res.ok && new URL(request.url).pathname.startsWith("/assets/")) {
    (await caches.open(SHELL)).put(request, res.clone());
  }
  return res;
}

const rutasDeAssets = (html) => [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);

async function guardarAssetsDe(res) {
  const rutas = rutasDeAssets(await res.text());
  const cache = await caches.open(SHELL);
  await Promise.allSettled(rutas.map(async (r) => (await cache.match(r)) || cache.add(r)));
}

async function assetsPresentes(res) {
  const rutas = rutasDeAssets(await res.text());
  if (!rutas.length) return false; // un HTML sin assets no pinta nada
  const hay = await Promise.all(rutas.map((r) => caches.match(r)));
  return hay.every(Boolean);
}
