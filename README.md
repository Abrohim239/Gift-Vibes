# Gift Vibes Business Manager

A Next.js + Supabase starter for managing products, orders, expenses, stock alerts, and a basic business dashboard.

## 1. Configure Supabase

Create `.env.local` in the project root using `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Use the **Project URL** and **Publishable key** from your new Gift Vibes Supabase project. Never use a service-role or secret key in browser code.

## 2. Install and run

```bash
npm install
npm run dev
```

## 3. Deploy

Push the project to your GitHub repository, then import it into Vercel. In Vercel → Settings → Environment Variables add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Redeploy after adding or changing environment variables.

## Important accounting notes

- Dashboard sales and estimated order profit currently count delivered orders only.
- Add product and expense records through the UI.
- In this starter version, order item entry and automatic stock deduction/restoration are not yet implemented.
- The database RLS policies permit any authenticated Supabase user. Configure Supabase Auth and restrict access to your own admin account before storing real customer data. Do not expose secret keys.
- Product purchases should be entered as stock movements in the database; avoid entering the same purchase again as a normal expense, or costs can be double-counted.
