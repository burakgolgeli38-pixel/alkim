-- Uygulamaci Gruplama Tablosu
-- Tutanaktaki firma sorumlusu isimlerini gruplara ayirir
-- Ornek: "Enes Dizman" ve "Muhammed Dizman" → "DIZMANLAR" grubu

CREATE TABLE IF NOT EXISTS uygulamaci_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name text NOT NULL UNIQUE,        -- "DIZMANLAR"
  members text[] NOT NULL DEFAULT '{}',   -- {"Enes Dizman", "Muhammed Dizman"}
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE uygulamaci_groups DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ug_group_name ON uygulamaci_groups(group_name);
