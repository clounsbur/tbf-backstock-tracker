# Warehouse Inventory Mapping App Spec

## Goal

Build an internal warehouse floor-mapping app that helps users:

- map inventory by floor location
- move inventory between pallet positions quickly
- view current inventory and open positions clearly
- get movement suggestions when dead space opens
- get placement suggestions for inbound inventory
- make placement suggestions for moving inventory out of temporary overflow and into designated backstock when space is available

## Core operating idea

The warehouse has seven set backstock areas that are named and are the primary inventory holding spaces. The warehouse also uses fixed front-facing home positions by ascending part number, while rear positions can be used as controlled reserve / temporary overflow when the home SKU does not currently need them. The designated inventory backstock areas are utilized as a first line and the controlled temporary overflow is reserved for use when all other backstock areas are at capacity. 

## Primary users

- forklift drivers
- leads / supervisors
- inventory control
- receiving
- CEO

## Main jobs to be done

1. See a visual map of the floor by aisle / bay / pallet position.
2. Search a SKU and immediately find all its current pallet positions.
3. Move a pallet in a few taps/clicks.
4. Validate whether a destination is allowed.
5. Suggest better positions when dead cubic space appears.
6. Suggest where inbound pallets should go.
7. Preserve the front/home slot for the assigned SKU.

## MVP features

### 1) Floor map

- Visual warehouse map by zone, aisle, bay, and depth position
- Each pallet location has a status:
  - occupied by home SKU
  - occupied by overflow SKU
  - reserved home slot
  - open flex slot
  - blocked / unavailable
- Filters by zone, part-number range, SKU family, occupancy status

### 2) Inventory lookup

- Search by SKU, part number, description
- Show on-hand pallet count and all current locations
- Show primary home location and overflow locations

### 3) Move workflow

- Select pallet or SKU

- Select destination

- Validate move rules before save

- Support quick actions like:

  - move overflow out
  - reclaim home reserve
  - consolidate SKU

### 4) Suggestion engine

- Recommend consolidation opportunities when a SKU occupies sparse locations
- Recommend using nearby flex slots when rear controlled reserve opens
- Recommend reclaiming borrowed reserve when home SKU replenishment is expected
- Recommend best-fit destination for inbound pallets based on:
  - home slot availability
  - nearest allowed flex slot
  - part-number adjacency
  - zone rules
  - velocity class

### 5) Inbound placement screen

- Enter SKU and pallet quantity
- Show ranked recommended locations
- Explain why each suggestion is valid

### 6) Audit history

- Move log
- Overrides and exceptions
- Occupancy history by location

## Business rules

1. Front position of a SKU's home lane must remain reserved for that SKU.
2. Rear positions may be borrowed only if marked as flex-capable.
3. Borrowing should stay within the same aisle / zone / part-number neighborhood.
4. Any overflow placement must be reversible.
5. Suggestions should prefer minimal travel distance.
6. Slow movers should not permanently consume deep reserve capacity.
7. Every move must update system state immediately.

## Data model

### Tables

#### sku

- id
- part\_number
- description
- velocity\_class
- product\_family
- pallets\_per\_full\_allocation
- active
- lot\_number

#### location

- id
- zone
- aisle
- bay
- level
- depth\_position
- full\_location\_code
- home\_sku\_id (nullable)
- is\_front\_home\_slot
- is\_flex\_slot
- status

#### pallet

- id
- pallet\_license\_plate
- sku\_id
- quantity
- received\_at
- current\_location\_id
- status

#### move\_transaction

- id
- pallet\_id
- from\_location\_id
- to\_location\_id
- moved\_by
- moved\_at
- reason\_code
- notes

#### inbound\_receipt

- id
- sku\_id
- pallet\_qty
- received\_by
- received\_at
- status

## Suggestion logic v1

### Consolidation suggestion

If SKU has open gaps within its home/flex neighborhood, suggest consolidating pallets to reduce fragmentation.

### Inbound suggestion ranking

Score candidate locations using:

- home slot match
- same aisle bonus
- nearest part-number bonus
- shortest travel distance
- preserve future reclaimability
- do not violate reserved front-slot rule

## UI ideas

### Screens

- Dashboard
- Floor map
- SKU search
- Move pallet
- Inbound placement
- Recommendations
- Audit history
- Admin rules

## Tech suggestion for MVP

- Frontend: React + TypeScript
- Backend: Node.js + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Auth: internal SSO or simple role login for MVP
- Deployment: internal web app

## Nice-to-have later

- barcode scanning
- handheld mode
- heat map of dead cube
- replenishment forecasts
- simulation mode for slotting changes
- Excel import/export
- WMS integration

## First milestone

Deliver an MVP that can:

1. define locations
2. assign home slots
3. place pallets
4. move pallets
5. display the map
6. recommend legal destinations for inbound and overflow pallets

##
