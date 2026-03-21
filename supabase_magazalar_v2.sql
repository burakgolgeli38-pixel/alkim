-- Magazalar tablosunu guncelle: gereksiz sutunlari kaldir, idari_isler_sorumlusu ekle
-- Eger tablo onceden olusturulduysa:
ALTER TABLE magazalar DROP COLUMN IF EXISTS bolge_muduru;
ALTER TABLE magazalar DROP COLUMN IF EXISTS bolge_yoneticisi;
ALTER TABLE magazalar DROP COLUMN IF EXISTS il;
ALTER TABLE magazalar DROP COLUMN IF EXISTS ilce;
ALTER TABLE magazalar ADD COLUMN IF NOT EXISTS idari_isler_sorumlusu text;
