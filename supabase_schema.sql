-- Tutanaklar tablosu
create table tutanaklar (
  id uuid primary key default gen_random_uuid(),
  no text,
  tarih text,
  mudahale_tarihi text,
  bolge text,
  magaza text,
  adres text,
  cagri_no text,
  konu text,
  aciklama text,
  firma_sorumlusu text,
  sorumlu text,
  gorsel_url text,
  created_at timestamptz default now()
);

-- Herkes okuyabilir ve yazabilir (RLS kapalı tutacağız başlangıçta)
alter table tutanaklar enable row level security;

create policy "Herkes okuyabilir" on tutanaklar
  for select using (true);

create policy "Herkes yazabilir" on tutanaklar
  for insert with check (true);

-- Storage bucket: tutanaklar
-- Supabase dashboard > Storage > New bucket > "tutanaklar" > Public: true
