-- 0002_seed_agency — the single default agency for the MVP (single-tenant, §12).
-- A fixed UUID the app references until real multi-tenant auth lands.
insert into agencies (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Demo Agency')
on conflict (id) do nothing;
