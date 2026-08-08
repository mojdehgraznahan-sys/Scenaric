-- Step 7, Implications (Build Plan §10). The implications table (0001_schema.sql) predates
-- any real writer — adding the citation field the §10 prompt requires. not null (no default)
-- is deliberate: per the spec, "implications must cite grounded_in_text or be rejected" —
-- a candidate with no citation should never reach a successful insert in the first place,
-- so the column itself refuses to allow that state rather than relying only on the AI
-- action's own filtering.
alter table public.implications add column grounded_in_text text not null;
