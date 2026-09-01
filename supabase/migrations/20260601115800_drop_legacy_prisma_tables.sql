-- This project (TBF Backstock Tracker) originally had a Prisma-managed schema
-- from the app's very first Express+Prisma architecture. That backend was
-- removed and the live app was rebuilt against a different Supabase project
-- (TBF Mobile Web APP) with a plain snake_case schema instead. These
-- PascalCase tables are leftovers: no code references them, and they hold no
-- current data. Clearing them out so this project can become the dedicated,
-- up-to-date home for this app's schema.

drop table if exists public."MoveTransaction" cascade;
drop table if exists public."Pallet" cascade;
drop table if exists public."Location" cascade;
drop table if exists public."InboundReceipt" cascade;
drop table if exists public."WarehouseArea" cascade;
drop table if exists public."Sku" cascade;
drop table if exists public._prisma_migrations cascade;
