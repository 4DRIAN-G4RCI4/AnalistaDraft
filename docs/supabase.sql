-- AnalistaDraft: predicciones guardadas y si se cumplieron. Correr una vez en el SQL Editor de Supabase.
create table if not exists predicciones (
  evento_id   text not null,
  mercado     text not null,              -- clave del modelo ("Local", "Más de 2.5 goles", "X anota"…)
  liga        text not null,
  fecha       timestamptz not null,       -- inicio del partido
  partido     text not null,              -- "Necaxa vs Atlas"
  nombre      text not null,              -- mercado con nombres de equipo ("Atlas o empate")
  categoria   text not null,              -- goles, tiempos, corners, tarjetas, tirosPuerta, tiros, jugadores
  prob        real not null,              -- probabilidad que dimos antes del partido
  cuota       real,                       -- cuota de la casa si la había
  resultado   text check (resultado in ('si', 'no')), -- null = aún sin revisar
  guardado_en timestamptz not null default now(),
  revisado_en timestamptz,
  primary key (evento_id, mercado)
);
create index if not exists predicciones_pendientes on predicciones (fecha) where resultado is null;

-- Solo el servidor lee y escribe (con la service_role key); el público no tiene acceso directo.
alter table predicciones enable row level security;
