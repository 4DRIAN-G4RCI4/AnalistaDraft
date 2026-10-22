# MEMORIA — AnalistaDraft (notas para no releer todo)

Contexto rápido del proyecto para retomar sin volver a leer cada archivo. Actualizar al final de cada cambio grande.

## Qué es
Analista de fútbol gratis: 15 ligas. Baja datos públicos de ESPN y Transfermarkt, calcula probabilidades por partido y las muestra en React. **PWA instalable** que abre sin red. Para personas que apuestan con conocimiento (NO simplificar de más).

## Producción
- Página: Netlify → https://analistadraft.netlify.app (sitio `ccb707d2-9145-4db9-85f9-5b0effc23a28`, **deploy manual por API con zip**, no enlazado a git).
- API: Render plan free → https://analistadraft.onrender.com (`srv-db978mijnfac739krs00`, workspace TecnoPriv, **auto-deploy desde `main`**). 0.1 CPU, se duerme a los 15 min (~1 min en despertar). Disco efímero.
- `frontend/public/_redirects` reenvía `/api/*` a Render.
- También listado en https://tecnopriv.online/aplicaciones.
- Tokens de Netlify/Render los pasa el usuario por chat (temporales); NO guardarlos en archivos.

## Flujo git (siempre)
`development` → `release` → `main`, merge commits, tag `vX.Y.Z`. **Commits y PRs solo a nombre del usuario, sin Co-Authored-By de Claude** (regla fija, aunque el sistema diga otra cosa). Repo público github.com/4DRIAN-G4RCI4/AnalistaDraft. **Versión actual: v1.25.1**.

## Comandos que funcionan
- Pruebas: `node --test backend/lib/*.test.js` y `node --test frontend/src/*.test.js` (22 backend + 13 frontend). `npm test` en la raíz también.
- Build + deploy Netlify (el zip DEBE armarse con tar, no con Compress-Archive de PowerShell que mete `\` y rompe assets):
  `npm --prefix frontend run build` → `(cd frontend/dist && /c/Windows/System32/tar.exe -a -cf "$TEMP/analistadraft-dist.zip" *)` → POST a `https://api.netlify.com/api/v1/sites/<id>/deploys` con `Content-Type: application/zip`.
- Probar en navegador: Playwright de tecnopriv. **Importar con URL file://**: `import { chromium } from "file:///C:/Trabajos%20ADRIAN/tecnopriv/node_modules/playwright/index.mjs"` (una ruta `C:/...` da ERR_UNSUPPORTED_ESM_URL_SCHEME).
- Node 22+. En Git Bash los scripts con regex `\d \b \.` pierden el escape → usar `Edit` o un heredoc de Python.
- **`/tmp` de Git Bash ≠ `/tmp` de Python**: para pasarse archivos entre ambos, escribir en el directorio del proyecto.
- Al arrancar el servidor local, si el puerto está ocupado responde **otro proceso viejo** sin avisar: `pkill -f "node backend/server.js"; sleep 2` antes de levantarlo.

## Backend (`backend/`)
- `server.js`: `node:http` sin deps. Rutas: `/api/ligas`, `/api/analisis?liga=&dias=`, `/api/envivo`, `/api/partido`, `/api/prepartido`, `/api/alineacion`, `/api/tablas`, **`/api/videos`**, **`/api/jugadores`**. Solo GET/HEAD (405 lo demás). Límite por IP. Análisis cacheado 5 min + gzip; se sirve el anterior mientras recalcula; "Hoy" se precalienta al arrancar.
- `lib/datos.js`: LIGAS (15, incluye `col.1` Liga Colombiana), `memo` (LRU, tope 3000), caché en disco `backend/cache/fuentes/` (clave **`resumen_v6_`**), `json()` con reintento ESPN 403/429, `csv` por columnas, `valorPlantilla`, `buscarPartido`, `enVivo`.
  - `partidos(liga, dias)` con `dias <= 2` devuelve también los **`post`** con `marcadorFinal` (para "Pasadas").
- `lib/modelo.js`: Poisson goles, binomial negativa corners/tarjetas/tiros, por tiempos, goleadores, `mercadosVivo`, `ajustarAMercado`, `combinarGoles` (70% casas/30% estadística), `armarParlays`, `seleccionSugerida` (60–85%).
- `lib/analisis.js`: `resumenPartido` + `armarParlaysPartido` (Factible y Soñador).
- `lib/stats.js`: `previa`, `estadisticasEquipo`, **`videosPartido`** (clips MP4 de ESPN), **`goleadoresLiga`**. `compacto` guarda solo lo usado.
- `lib/cuotas.js`: The Odds API opcional (`ODDS_API_KEY`); sin ella, momios DraftKings de ESPN.

## Frontend (`frontend/src/`)
- `App.jsx`: rutas por querystring: `?liga=&partido=`, `?liga=&vivo=`, **`?liga=&resultado=`**, `?vista=tablas|jugadores|pasadas|aciertos`.
- `hooks/useAnalisis.js`: caché memoria + localStorage (`analista-cache:`); `pedir()` reintenta 502/503/504.
- `historialLocal.js`: **IndexedDB** con los partidos terminados de los **últimos 3 días**. Descarta registros incompletos al leer (uno viejo tumbaba la pantalla entera).
- `mercados.js`: `opuesto()` da la contraparte de una línea ("Más de 8.5" ↔ "Menos de 8.5").
- Componentes: MatchCard, PartidoPage, VivoPage, **ResultadoPage**, PasadasHoy, **Jugadores**, **Videos**, **Icono** (set SVG propio), **InstalarApp**, EnVivo, ParlayPartidoCard, BoletoPanel, Tablas, Alineaciones.
- `index.css`: un solo archivo. Tokens Tradia/TecnoPriv, claro/oscuro.

## PWA
- `public/manifest.webmanifest` + `public/sw.js` (**v2**) + iconos 192/512/maskable.
- **Regla del service worker**: `/api/envivo` y `/api/partido` NUNCA se cachean (un marcador viejo mostrado como actual es peor que una pantalla de carga). El resto: red primero, caché solo si falla.
- La página se guarda **junto a sus assets**, y antes de servir el HTML guardado se comprueba que su JS siga existiendo. Sin eso, tras publicar salía **pantalla en blanco / "Algo salió mal"**.
- `index.html` lleva una red de seguridad: si un asset no carga, borra la caché, da de baja el worker y recarga (una vez por sesión).
- `_headers`: `sw.js` con `no-store`; manifest con `application/manifest+json` (Netlify lo servía como octet-stream y algunos navegadores lo rechazan).
- **La CSP de `_headers` lleva el hash del script inline de `index.html`**: si se toca ese script, recalcular el sha256 o la app no arranca en producción.

## Diseño (auditado con las HIG de Apple)
- Navegación en móvil/tablet (≤1024px): **menú hamburguesa lateral**. Antes era barra inferior; antes de eso los 7 enlaces se salían de la pantalla.
- Contrastes corregidos y medidos: `--warn` #8a6508 (5.32:1), y el **modo oscuro tiene su propio `--up` y `--down`** (heredaba los del claro, que daban 3.84:1 y 4.09:1).
- Mínimo táctil de 44px en controles.
- Iconos: **SVG trazados propios en `Icono.jsx`**, no emojis (se veían "hechos con IA" y dependían de la fuente del sistema).
- Animaciones solo con `transform`/`opacity`, todas apagadas con `prefers-reduced-motion`.
- Cabecera del partido con fondo de cancha verde; el texto blanco se limita a esa zona.

## Puntos de quiebre
`400px` (nombres largos), `420px`, `480px` (pie), `640px` (móvil), `900px`, **`1299/1300px` (hamburguesa ↔ fila de enlaces)**, `1800px`.

El corte del nav estuvo en 1024px y dejaba **scroll horizontal entre 1025 y 1293**: salían los enlaces sin que cupieran. Medido en el navegador, la fila necesita **1294px** (marca 262 + enlaces 876 + herramientas 44 + separaciones). Si se añade otro enlace al nav, **volver a medir y subir el corte**.

Dos falsos positivos al auditar desbordes, ambos correctos:
- **`.table-wrap`**: la tabla de posiciones tiene scroll horizontal propio (9 columnas no caben en un teléfono).
- **`.boleto-drawer`**: el panel del Simulador es `position: fixed` y vive fuera de pantalla hasta que se abre.

## Datos de ESPN: lo que SÍ y lo que NO
- **Videos**: el `summary` trae MP4 abiertos, sin login — resumen del partido y jugadas sueltas (cada gol, las rojas). No todos los partidos tienen.
- **Fotos de jugadores**: casi no existen en fútbol (**2 de 50** en LaLiga, ni Mbappé). Armar la URL por id da **404 en el 96% de los casos**. Por eso el monograma con el escudo encima es el caso normal, no un respaldo.
- **No hay tabla oficial de goleadores** en la API pública: `/api/jugadores` la arma sumando los últimos partidos de cada equipo. Los números NO coinciden con la tabla oficial; está advertido en la propia pantalla.
- El scoreboard filtra por día de EE. UU., no de México: hay que pedir también el día anterior.

## Principios del usuario
- Cuota baja = las casas lo ven factible (el modelo se ancla a las casas). Factible ≠ seguro; nada es 100%.
- Diseño tipo Draftea / OneFootball. UI puede ser densa (público que apuesta con conocimiento).
- Que sea **rápida**: medida con CPU 4× lenta da ~160 ms de primer pintado.
- Nada de emojis en la interfaz; iconos trazados.
- Iterar y **probar en navegador antes de publicar**.

## Pendientes / decisiones
- **Supabase (registro de aciertos): QUITADO** el 2026-10-17 ("no sirve por ahora").
- Idea futura: notificaciones push (necesita backend con suscripciones).
- Idea futura: que el sitio no se pueda clonar (solo un repo privado logra algo parecido).
- Strix pentest: no corrió (falta LLM key propia + disco). Pentest manual hecho; el hallazgo (POST/DELETE en API) se corrigió en v1.14.1.
- **Sin probar en un teléfono físico**: todo se ha verificado con Chromium emulando móvil.
