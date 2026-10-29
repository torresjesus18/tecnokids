-- Registra el Taller de Ensamblaje sin modificar las misiones ni avances existentes.
INSERT INTO missions (slug, title, description, category, difficulty, max_score, active) VALUES
  ('taller-ensamblaje', 'Taller de Ensamblaje', 'Arrastra las piezas al gabinete y descubre cómo se ensambla un computador.', 'hardware', 1, 100, true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  difficulty = EXCLUDED.difficulty,
  max_score = EXCLUDED.max_score,
  active = EXCLUDED.active;
