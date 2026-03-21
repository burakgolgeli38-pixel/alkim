-- Birim Fiyatlar tablosu
CREATE TABLE IF NOT EXISTS birim_fiyatlar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poz_no text NOT NULL UNIQUE,
  poz_tanimi text NOT NULL,
  poz_birim_fiyat_tarifesi text,
  marka_model text,
  birim text,
  birim_fiyat numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE birim_fiyatlar DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bf_poz_no ON birim_fiyatlar(poz_no);
