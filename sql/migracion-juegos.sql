-- Ejecutar UNA vez en pgAdmin (Query Tool sobre la base "tecnokids"). No borra usuarios ni contraseñas.
ALTER TABLE player_progress ADD COLUMN IF NOT EXISTS coins INT NOT NULL DEFAULT 0 CHECK (coins >= 0);

CREATE TABLE IF NOT EXISTS user_pc (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cpu VARCHAR(10) NOT NULL,
  ram VARCHAR(10) NOT NULL,
  gpu VARCHAR(10) NOT NULL,
  rom VARCHAR(10) NOT NULL DEFAULT 'rom1'
);
CREATE TABLE IF NOT EXISTS user_components (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  component_code VARCHAR(10) NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, component_code)
);
CREATE TABLE IF NOT EXISTS game_sessions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game VARCHAR(20) NOT NULL,
  profile JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  coins_awarded INT NOT NULL DEFAULT 0,
  result JSONB
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON game_sessions(user_id);

ALTER TABLE missions ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE missions SET active = FALSE WHERE slug IN ('quiz','sim-texto','sim-educativo','sim-3d');
INSERT INTO missions (slug, title, description, category, difficulty, max_score) VALUES
 ('carrera', 'Carrera Cósmica', 'Compite contra dos robots y mira cómo se porta tu PC.', 'juego', 1, 100),
 ('defensa', 'Defensa Galáctica', 'Defiende la base de tres oleadas. ¡Exige mucho a tu PC!', 'juego', 3, 100)
ON CONFLICT (slug) DO NOTHING;

DELETE FROM user_achievements WHERE achievement_id IN (SELECT id FROM achievements WHERE code IN ('primer_paso','cerebrito','constructor','ahorrador'));
DELETE FROM achievements WHERE code IN ('primer_paso','cerebrito','constructor','ahorrador');
INSERT INTO achievements (code, name, description, icon) VALUES
 ('primer_arranque', 'Primer arranque', 'Termina tu primera partida.', '🚀'),
 ('campeon', 'Campeón', 'Gana una Carrera Cósmica.', '🏆'),
 ('defensor', 'Defensor galáctico', 'Gana la Defensa Galáctica.', '🛡️'),
 ('ingeniero', 'Ingeniero', 'Compra tu primer componente.', '🛠️'),
 ('pc_ideal', 'PC ideal', 'Juega sin tirones ni fallos.', '💡')
ON CONFLICT (code) DO NOTHING;

-- Juegos nuevos: intermedio y experto (nivel de dificultad 4).
-- El CHECK original solo permitía 1..3, así que se amplía a 1..4.
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_difficulty_check;
ALTER TABLE missions ADD CONSTRAINT missions_difficulty_check CHECK (difficulty BETWEEN 1 AND 4);
INSERT INTO missions (slug, title, description, category, difficulty, max_score, active) VALUES
 ('clasificador', 'La Caza de Chips', 'Clasifica los componentes informáticos que caen', 'intermedio', 2, 100, true),
 ('ciber-guardian', 'Defensa del Sistema', 'Protege la CPU destruyendo virus y malware', 'experto', 4, 100, true)
ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title;

-- Insignias de los juegos nuevos y de la Ruleta Tecno.
INSERT INTO achievements (code, name, description, icon) VALUES
 ('experto_clasificador', 'Clasificador experto', 'Atrapa el Componente y consigue 60 puntos o más.', '🧲'),
 ('guardian', 'Guardián del sistema', 'Protege la CPU en Defensa del Sistema.', '🛡️'),
 ('afortunado', 'Afortunado', 'Gira la Ruleta Tecno.', '🎡')
ON CONFLICT (code) DO NOTHING;