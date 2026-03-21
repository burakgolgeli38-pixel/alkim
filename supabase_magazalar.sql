-- Magazalar tablosu (referans veri)
-- Magaza kodu ile magaza adi ve bolge eslestirmesi

CREATE TABLE IF NOT EXISTS magazalar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kod text NOT NULL UNIQUE,
  magaza_adi text NOT NULL,
  idari_bolge text,
  bolge_muduru text,
  bolge_yoneticisi text,
  il text,
  ilce text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE magazalar DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_mag_kod ON magazalar(kod);
CREATE INDEX IF NOT EXISTS idx_mag_idari_bolge ON magazalar(idari_bolge);
