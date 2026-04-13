# User Flows

## 1. Trainer Onboarding

1. Trainer visits trainersource.com landing page
2. Clicks "Apply" and fills out application (name, email, phone, country, city, niche, social media)
3. Application saved to `trainers` table with status `applied`
4. Admin reviews and approves application -- status moves to `onboarding`
5. Trainer receives onboarding link (videos + quiz)
6. Trainer watches all videos and passes quiz
7. Status moves to `active`, `onboarding_completed_at` is set, commission rate assigned
8. Trainer can now log in to dashboard and generate access codes

## 2. Customer Purchase

1. Trainer generates a one-time access code from their dashboard (7-day expiry)
2. Trainer shares code with prospective customer
3. Customer visits ultimate-peptides.com and enters code at the access gate
4. Code validated via Supabase -- if valid, customer is created in `customers` table with `trainer_id` attribution
5. Code status set to `consumed`, customer enters the storefront
6. Customer browses catalog, selects products, completes ACH checkout (Paychron)
7. BigCommerce webhook fires -- order saved to `orders` table with trainer attribution, commission created in `commissions` table
8. ShipStation fulfills order, status updates flow back via webhooks

## 3. Admin Operations

- **View all trainers** -- filter by status (applied / onboarding / active / suspended), country, city
- **Approve/reject applications** -- move trainer through status pipeline
- **View all orders** -- filter by region, trainer, date range
- **Manage commissions** -- review pending commissions, approve for payout
- **Batch payouts** -- select approved commissions, group by trainer, trigger Wise transfer
- **Generate founder/organic codes** -- codes not tied to any trainer (for direct/organic traffic)
- **Suspend trainers** -- set status to `suspended`, deactivate their codes
