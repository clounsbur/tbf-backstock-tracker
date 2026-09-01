-- ============================================================================
-- Add RELEASED_TO_PICKING to the move_transactions reason_code CHECK so bulk
-- (and single) release-to-picking-floor actions can be logged distinctly.
-- ============================================================================
begin;

alter table public.move_transactions
  drop constraint if exists move_transactions_reason_code_check;

alter table public.move_transactions
  add constraint move_transactions_reason_code_check
  check (reason_code in (
    'STANDARD_MOVE',
    'INBOUND_PUTAWAY',
    'OVERFLOW_RELOCATION',
    'RECLAIM_HOME_SLOT',
    'CONSOLIDATION',
    'ADJUSTMENT',
    'RELEASED_TO_PICKING'
  ));

commit;
