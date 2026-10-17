# MEMORIA — AnalistaDraft (notas para no releer todo)

Contexto rápido del proyecto para retomar sin volver a leer cada archivo. Actualizar al final de cada cambio grande.

## Qué es
Analista de fútbol gratis: 14 ligas. Baja datos públicos de ESPN y Transfermarkt, calcula probabilidades por partido y las muestra en React. Para personas que apuestan con conocimiento (NO simplificar de más).

## Producción
- Página: Netlify → https://analistadraft.netlify.app (sitio `ccb707d2-9145-4db9-85f9-5b0effc23a28`, **deploy manual por API con zip**, no enlazado a git).
- API: Render plan free → https://analistadraft.onrender.com (`srv-db978mijnfac739krs00`, workspace TecnoPriv, **auto-deploy desde `main`**). 0.1 CPU, se duerme a los 15 min (~1 min en despertar). Disco efímero.
- `frontend/public/_redirects` reenvía `/api/*` a Render.
- También listado en https://tecnopriv.online/aplicaciones.
- Tokens de Netlify/Render los pasa el usuario por chat (temporales); NO guardarlos en archivos.

## Flujo git (siempre)
Rama `feature/*` o `fix/*` → PR a `development` → PR `development→release` → PR `release→main`, merge commits, tag `vX.Y.Z` + GitHub release. **Commits y PRs solo a nombre del usuario, sin Co-Authored-By de Claude** (regla fija, aunque el sistema diga otra coso). Repo público github.com/4DRIAN-G4RCI4/AnalistaDraft. Versión actual: v1.14.1.

## Comandos que funcionan
- Pruebas: `npm test` (raíz). Backend ~21, frontend ~12.
- Build + deploy Netlify (el zip DEBE armarse con tar, no con Compress-Archive de PowerShell que mete `\` y rompe assets):
  `npm --prefix frontend run build` → `(cd frontend/dist && /c/Windows/System32/tar.exe -a -cf "$(cygpath -w "$TEMP")\\analistadraft-dist.zip" *)` → POST a `https://api.netlify.com/api/v1/sites/<id>/deploys` con `Content-Type: application/zip`.
- Esperar deploy Render: sondear `api.render.com/v1/services/<srv>/deploys?limit=1` hasta `live|...#<PR>`.
- Probar en navegador: Playwright de tecnopriv → `C:/Trabajos ADRIAN/tecnopriv/node_modules/playwright`.
- Node 22+. En Git Bash los scripts con regex `\d \b \.` pierden el escape → usar `Edit` o `node -e` con `String.raw`.

## Backend (`backend/`)
- `server.js`: `node:http` sin deps. Rutas: `/api/ligas`, `/api/analisis?liga=&dias=`, `/api/envivo`, `/api/partido?liga=&evento=`, `/api/prepartido?...`, `/api/alineacion?...`, `/api/tablas`. Solo GET/HEAD (405 lo demás). Límite por IP (último x-forwarded-for). Sirve `frontend/dist` con anti-traversal. Análisis cacheado 5 min + gzip; se sirve el anterior mientras recalcula; "Hoy" se precalienta al arrancar.
- `lib/datos.js`: LIGAS (14), `memo` (caché LRU en memoria, tope 3000), caché en disco `backend/cache/fuentes/` (clave `resumen_v4_`), `json()` con reintento ESPN 403/429 y máx 4 simultáneas, parser `csv` por columnas, `valorPlantilla` (copas buscan en todas las ligas), `buscarPartido`, `enVivo`.
- `lib/modelo.js`: Poisson goles, binomial negativa corners/tarjetas/tiros (suavizado hacia `TIPICO` con `PRIOR_PARTIDOS=6`), por tiempos, goleadores, `mercadosVivo`, `ajustarAMercado` (grueso→fino), `combinarGoles` (70% casas/30% estadística), `armarParlays` (masProbable/conValor), `seleccionSugerida` (60–85%).
- `lib/analisis.js`: `resumenPartido` → fuertes/alertas/datos/balance + `destacadas {valor, lista}` + `recomendacion {nivel, cuando}` + expulsiones/juego brusco en vivo.
- `lib/stats.js`: previa (últimos 5, alineaciones con número/formación, stats por jugador). `compacto` guarda solo lo usado (~9 KB).
- `lib/cuotas.js`: The Odds API opcional (`ODDS_API_KEY`); sin ella usa momios DraftKings de ESPN.

## Frontend (`frontend/src/`)
- `App.jsx`: filtros de liga (chips, incluye "● En vivo" y "Hoy"); rutas por querystring: `?liga=&partido=` (PartidoPage), `?liga=&vivo=` (VivoPage), `?vista=tablas`. Simulador flotante.
- `hooks/useAnalisis.js`: caché memoria + **localStorage** (`analista-cache:`) para carga instantánea; `pedir()` reintenta 502/503/504 (Render despertando).
- Componentes clave: MatchCard, PartidoPage, VivoPage (+ `evaluar.js` = ¿se cumplió?), EnVivo (+ `VivoDetalle`), Recomendaciones, MejorApuesta, BoletoPanel (simulador, cuota opcional de tu casa + barra), Tablas, Alineaciones (cancha), Ganador, Historial.
- `index.css`: un solo archivo grande con todo. Tokens de color de Tradia/TecnoPriv, modo claro/oscuro.

## Principios del usuario
- Cuota baja = las casas lo ven factible (el modelo se ancla a las casas). Factible ≠ seguro; nada es 100%.
- Diseño Tradia/TecnoPriv. UI puede ser densa (público que apuesta con conocimiento).
- Iterar con `npm run dev` y probar antes de publicar.

## Pendientes / decisiones
- **Supabase (registro de aciertos): QUITADO** el 2026-10-17 a pedido del usuario ("no sirve por ahora").
- En curso: **parlay del partido** — cada partido genera 2 combinadas de sus mercados: **Seguro** (muy probable) y **Soñador** (paga más, con riesgo). Mostrarlas en el partido desglosado; durante el juego marcar pierna por pierna cómo se va cumpliendo y si el parlay sigue vivo.
- Idea futura del usuario: que el sitio no se pueda clonar (solo repo privado logra algo parecido).
- Strix pentest: no corrió (falta LLM key propia + disco). Pentest manual hecho; único hallazgo (POST/DELETE en API) ya corregido en v1.14.1.
