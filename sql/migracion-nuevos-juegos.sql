-- Ejecutar una vez después de migracion-juegos.sql y migracion-rom.sql.
-- Registra los dos minijuegos sin borrar ni modificar el progreso existente.
INSERT INTO missions (slug, title, description, category, difficulty, max_score, active) VALUES
  ('organizador-disco', 'El Organizador de Disco', 'Acomoda bloques de archivos para completar filas y liberar espacio.', 'intermedio', 2, 100, true),
  ('laberinto-datos', 'Laberinto de Datos', 'Guía a Byte, recoge paquetes y evita a los virus.', 'intermedio', 2, 100, true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  difficulty = EXCLUDED.difficulty,
  max_score = EXCLUDED.max_score,
  active = EXCLUDED.active;
