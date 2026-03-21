-- ALKIM Tutanak Sistemi - Schema v2
-- tutanaklar tablosuna magaza_no ekle
ALTER TABLE tutanaklar ADD COLUMN IF NOT EXISTS magaza_no text;

-- Is kalemleri tablosu
CREATE TABLE IF NOT EXISTS tutanak_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutanak_id uuid REFERENCES tutanaklar(id) ON DELETE CASCADE,
  sira_no integer NOT NULL,
  aciklama text,
  miktar numeric DEFAULT 1,
  birim text DEFAULT 'Adet',
  poz_kodu text DEFAULT 'S-09',
  poz_aciklama text,
  birim_fiyat numeric DEFAULT 0,
  toplam_tutar numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS politikalari
ALTER TABLE tutanak_items ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir ve yazabilir (service_role zaten bypass eder)
CREATE POLICY "read_all" ON tutanak_items FOR SELECT USING (true);
CREATE POLICY "insert_all" ON tutanak_items FOR INSERT WITH CHECK (true);
CREATE POLICY "update_all" ON tutanak_items FOR UPDATE USING (true);
CREATE POLICY "delete_all" ON tutanak_items FOR DELETE USING (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tutanak_items_tutanak_id ON tutanak_items(tutanak_id);
