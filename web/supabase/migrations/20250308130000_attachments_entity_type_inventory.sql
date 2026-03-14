-- Allow attachments to be linked to boat inventory items (entity_type = 'inventory').

alter table public.attachments drop constraint if exists attachments_entity_type_check;
alter table public.attachments add constraint attachments_entity_type_check
  check (entity_type in ('boat','engine','service','equipment','logbook','haulout','project','inventory'));
