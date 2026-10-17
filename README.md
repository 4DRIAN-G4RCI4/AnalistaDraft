# AnalistaDraft

Analista de fútbol gratuito: partidos, tabla, forma, valor de plantilla, noticias y lo que pagan las casas, combinados en un modelo estadístico para encontrar las apuestas más probables de cada partido.

> Probabilidades estimadas con datos públicos. **Ninguna apuesta es 100% segura.** Es información, no asesoría de apuestas.

## Qué hace

- **Partidos** de 14 ligas: Liga MX, Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, Conference League, Eredivisie, Saudi Pro League, MLS, Liga Argentina y Brasileirão (hoy, en vivo o próximos 3, 7 o 14 días).
- **En vivo:** marcador, estadísticas, alineaciones y sugerencias que toman en cuenta el tiempo que queda y las expulsiones.
- **Tablas de posiciones** de todas las ligas.
- **Lo más recomendable** de cada partido entre goles, tiempos, corners, tarjetas, tiros a puerta, tiros y jugadores, con su razón, lo que paga (decimal y americano) y cuándo conviene apostar.
- **Página por partido** con todos los mercados, análisis, últimos 5 partidos de cada equipo y noticias.
- **Parlays sugeridos** (más probable y con valor) y un **simulador de boleto** con ganancia estimada. Aquí no se apuesta.

## Cómo calcula

- Goles esperados con un modelo Poisson (goles a favor y en contra, localía y valor de plantilla) **ajustado a lo que pagan las casas** (70% casas, 30% estadística): cuota baja = las casas lo ven factible.
- Corners, tarjetas y tiros con binomial negativa a partir de los últimos 5 partidos de cada equipo (incluye copas).
- Por tiempos: según en qué tiempo suelen caer los goles de ambos equipos. Jugadores: su parte de los tiros y goles del equipo.

## Fuentes (gratis, sin registro)

| Fuente | Datos | Caché |
|---|---|---|
| ESPN | partidos, tabla, momios DraftKings, noticias, estadísticas, alineaciones | 20 min – 2 h; partidos jugados para siempre |
| [transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) | valor de plantilla | 24 h |
| [The Odds API](https://the-odds-api.com) (opcional) | cuotas de varias casas | 12 h |
