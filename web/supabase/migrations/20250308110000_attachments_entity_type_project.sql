-- Allow attachments to be linked to boat projects (entity_type = 'project').
-- Drop existing check and re-add with 'project' included.
-- Default PG constraint name for "check (entity_type in (...))" is attachments_entity_type_check.

alter table public.attachments drop constraint if exists attachments_entity_type_check;
alter table public.attachments add constraint attachments_entity_type_check
  check (entity_type in ('boat','engine','service','equipment','logbook','haulout','project'));
