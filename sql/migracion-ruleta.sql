-- Ejecutar UNA vez en pgAdmin (Query Tool sobre la base "tecnokids"). No borra usuarios ni contraseñas.
-- Ruleta de Recompensas: guarda cuándo fue el último giro gratis de cada niño.
ALTER TABLE player_progress ADD COLUMN IF NOT EXISTS last_free_spin TIMESTAMPTZ DEFAULT NULL;
