CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS missions (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(40) UNIQUE NOT NULL,
  title VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(30) NOT NULL,
  difficulty INT NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  max_score INT NOT NULL DEFAULT 100
);
CREATE TABLE IF NOT EXISTS player_progress (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_points INT NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  level INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mission_attempts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id INT NOT NULL REFERENCES missions(id),
  score INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  completed BOOLEAN NOT NULL,
  result_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attempts_user_mission ON mission_attempts(user_id, mission_id);
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(60) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(10) NOT NULL
);
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INT NOT NULL REFERENCES achievements(id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

INSERT INTO missions (slug, title, description, category, difficulty) VALUES
 ('quiz', '¿Para qué sirve este programa?', 'Elige la herramienta perfecta para cada situación.', 'software', 1),
 ('sim-texto', 'PC para escribir', 'Arma un computador que ejecute el Editor de texto.', 'hardware', 1),
 ('sim-educativo', 'PC para aprender jugando', 'Arma un computador para el Juego educativo.', 'hardware', 2),
 ('sim-3d', 'PC para videojuegos 3D', 'El reto más grande: un videojuego 3D exigente.', 'hardware', 3)
ON CONFLICT (slug) DO NOTHING;
INSERT INTO achievements (code, name, description, icon) VALUES
 ('primer_paso', 'Primer paso', 'Completa tu primera misión.', '🚀'),
 ('cerebrito', 'Cerebrito', 'Responde todo bien en el quiz.', '🧠'),
 ('constructor', 'Constructor', 'Haz funcionar el videojuego 3D.', '🛠️'),
 ('ahorrador', 'Ahorrador inteligente', 'Arma un PC perfecto sin gastar de más.', '💡')
ON CONFLICT (code) DO NOTHING;
