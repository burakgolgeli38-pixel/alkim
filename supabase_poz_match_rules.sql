-- POZ Eslestirme Kurallari Tablosu
-- Dinamik, veri tabanli POZ kodu eslestirme sistemi

CREATE TABLE IF NOT EXISTS poz_match_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keywords text[] NOT NULL,
  exclude_keywords text[],
  poz_kodu text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  source text DEFAULT 'manual',
  example_aciklama text,
  hit_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS devre disi (diger tablolarla tutarli)
ALTER TABLE poz_match_rules DISABLE ROW LEVEL SECURITY;

-- Indexler
CREATE INDEX IF NOT EXISTS idx_pmr_priority ON poz_match_rules(priority ASC);
CREATE INDEX IF NOT EXISTS idx_pmr_poz_kodu ON poz_match_rules(poz_kodu);
CREATE INDEX IF NOT EXISTS idx_pmr_active ON poz_match_rules(is_active);

-- Hit count artirma fonksiyonu
CREATE OR REPLACE FUNCTION increment_hit_count(rule_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE poz_match_rules
  SET hit_count = hit_count + 1,
      updated_at = now()
  WHERE id = rule_id;
END;
$$ LANGUAGE plpgsql;
