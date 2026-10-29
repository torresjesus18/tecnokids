-- Registra Desafío de Renderizado GPU sin modificar misiones ni avances existentes.
INSERT INTO missions (slug, title, description, category, difficulty, max_score, active) VALUES
  ('renderizado-gpu', 'Desafío de Renderizado GPU', 'Pilota un cohete GPU, recoge núcleos y esquiva el polvo que puede obstruir la ventilación y sobrecalentar la tarjeta.', 'hardware', 2, 100, true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  difficulty = EXCLUDED.difficulty,
  max_score = EXCLUDED.max_score,
  active = EXCLUDED.active;
