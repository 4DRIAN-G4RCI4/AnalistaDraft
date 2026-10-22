// Historial de partidos terminados, guardado en el teléfono (IndexedDB).
//
// No lo sirve el servidor: cada visita guarda los partidos que ya terminaron y se conservan los
// últimos 3 días. Así "Pasadas" no le cuesta nada a Render y abre al instante. El límite es que
// solo aparecen los días en que se abrió la app.

const BD = "analista-historial";
const TIENDA = "partidos";
const DIAS = 3;

const diaDe = (fecha) => new Date(fecha).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

const hoyYAnteriores = () =>
  Array.from({ length: DIAS }, (_, i) => diaDe(Date.now() - i * 864e5));

function abrir() {
  return new Promise((ok, mal) => {
    const req = indexedDB.open(BD, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TIENDA)) {
        db.createObjectStore(TIENDA, { keyPath: "id" }).createIndex("dia", "dia");
      }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
}

// Un partido guardado por una versión anterior puede venir sin campos que la tarjeta necesita;
// si se pinta, tumba toda la pantalla. Se descarta en silencio.
const completo = (p) =>
  Boolean(
    p?.local?.nombre &&
      p?.visita?.nombre &&
      p?.probs?.Local != null &&
      p?.golesEsperados?.local != null &&
      p?.resumen?.alertas &&
      Array.isArray(p?.noticias) &&
      p?.marcadorFinal?.local,
  );

const terminar = (tx) => new Promise((ok, mal) => {
  tx.oncomplete = () => ok();
  tx.onerror = () => mal(tx.error);
});

// Guarda los que terminaron y borra lo que pasó de 3 días. Si IndexedDB no está, no pasa nada.
export async function guardarPasadas(partidos) {
  if (!partidos?.length || !globalThis.indexedDB) return;
  try {
    const db = await abrir();
    const tx = db.transaction(TIENDA, "readwrite");
    const t = tx.objectStore(TIENDA);
    for (const p of partidos) t.put({ ...p, dia: diaDe(p.fecha), guardado: Date.now() });

    // limpieza: lo que ya no entra en la ventana de 3 días
    const vigentes = new Set(hoyYAnteriores());
    t.getAll().onsuccess = (e) => {
      for (const p of e.target.result) if (!vigentes.has(p.dia)) t.delete(p.id);
    };
    await terminar(tx);
    db.close();
  } catch {
    // sin espacio o en modo privado: el historial simplemente no se guarda
  }
}

// Los partidos terminados de los últimos 3 días, del más reciente al más viejo.
export async function leerPasadas() {
  if (!globalThis.indexedDB) return [];
  try {
    const db = await abrir();
    const tx = db.transaction(TIENDA, "readonly");
    const todos = await new Promise((ok, mal) => {
      const r = tx.objectStore(TIENDA).getAll();
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    db.close();
    const vigentes = new Set(hoyYAnteriores());
    return todos
      .filter((p) => vigentes.has(p.dia) && completo(p))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  } catch {
    return [];
  }
}

// Para agrupar en pantalla: "Hoy", "Ayer" o la fecha.
export function etiquetaDia(dia) {
  const [hoy, ayer] = hoyYAnteriores();
  if (dia === hoy) return "Hoy";
  if (dia === ayer) return "Ayer";
  return new Date(`${dia}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}
