-- Ejecutar una vez después de migracion-juegos.sql en la base "tecnokids".
-- Conserva usuarios existentes y les asigna el almacenamiento inicial gratuito.
ALTER TABLE user_pc ADD COLUMN IF NOT EXISTS rom VARCHAR(10) NOT NULL DEFAULT 'rom1';

INSERT INTO user_components (user_id, component_code)
SELECT user_id, 'rom1' FROM user_pc
ON CONFLICT (user_id, component_code) DO NOTHING;
