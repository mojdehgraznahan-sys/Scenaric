-- Step 8, Indicators (Build Plan §11). indicators predates any real writer — adding the
-- one column its own spec requires that's actually missing: "Each indicator must map to
-- exactly one storyline_node's mechanism (grounded_in)". Nullable (unlike
-- implications.grounded_in_text's not-null) because a discriminating-rejection failure
-- still needs an honest "no indicators generated" result rather than a constraint violation
-- blocking the whole call — ai-indicators.ts filters ungrounded candidates before insert,
-- same defense-in-depth spirit as implications, just enforced in code here instead of the
-- column itself since a per-row nullable FK is the correct shape for "references one
-- specific node," unlike implications' free-text citation.
alter table public.indicators add column grounded_in uuid references public.storyline_nodes(id) on delete set null;
