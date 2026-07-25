-- E-mail capturado na busca (Google Maps / site)
alter table public.leads
  add column if not exists email text;
