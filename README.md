# TrainerSource

The **brain** of the peptide distribution platform. TrainerSource manages the trainer network, commissions, access codes, and admin operations. The storefront ([Ultimate Peptides](https://github.com/shrchauhan97/ultimate-peptides)) is a separate, disposable entity.

## The Octopus Model

| Entity | Role | Domain |
|--------|------|--------|
| **TrainerSource** | Brain -- durable asset. Trainer network, commissions, admin, data | trainersource.com |
| **Ultimate Peptides** | Tentacle -- disposable storefront. Products, checkout, shipping | ultimate-peptides.com |

TrainerSource is the part that survives if the storefront ever needs to be swapped. All trainer relationships, customer attribution, and commission data live here.

## What It Does

- **Trainer recruitment portal** -- public landing page with application form
- **Onboarding flow** -- training videos + quiz, must pass before generating codes
- **Trainer dashboard** -- generate one-time access codes, view attributed clients, track commissions
- **Admin panel** -- separate auth (Tim & Matt are superadmins), full data visibility with region filtering
- **Commission engine** -- per-order commission calculation, batch payouts via Wise
- **Access code system** -- one-time codes (7-day expiry) that gate the Ultimate Peptides storefront and attribute customers to the issuing trainer

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend | Google Stitch (Tim built it) -- will be extracted and deployed |
| Database + Auth | Supabase |
| Hosting | Vercel |
| Payouts | Wise API (batch transfers) |
| Domain | trainersource.com (GoDaddy -> Vercel) |

## Related Repos

| Repo | Purpose |
|------|---------|
| [`trainer-source`](https://github.com/shrchauhan97/trainer-source) | Planning docs, KB, diagrams (pre-implementation) |
| [`ultimate-peptides`](https://github.com/shrchauhan97/ultimate-peptides) | Storefront (BigCommerce + ShipStation) |

## Project Structure

```
trainersource-app/
  docs/
    schema.sql          # Complete Supabase-ready database schema
    data-model.mmd      # Mermaid ER diagram
    architecture.mmd    # System architecture diagram
    user-flows.md       # Trainer, customer, and admin flows
  .env.example          # Environment variable template
  .gitignore
```

## Getting Started

> **Status**: Pre-implementation. Supabase project not yet created.

1. Copy `.env.example` to `.env.local` and fill in credentials
2. Create Supabase project and run `docs/schema.sql`
3. Point `trainersource.com` DNS to Vercel
4. Deploy

Full requirements: [Notion Build Spec](https://www.notion.so/) (team access required)

## Database

7 tables: `admins`, `trainers`, `access_codes`, `customers`, `orders`, `payouts`, `commissions`

See [`docs/schema.sql`](docs/schema.sql) for the complete Supabase-ready schema and [`docs/data-model.mmd`](docs/data-model.mmd) for the ER diagram.
