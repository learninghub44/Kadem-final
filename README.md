# Kadem Marketing Agency

A membership-based earning platform where users earn from WhatsApp status views.

## Tech Stack
- **Frontend**: React + Tailwind → Cloudflare Pages
- **Backend**: Node.js + Express → Render
- **Database**: Supabase (PostgreSQL)
- **Payments**: PayHero (M-Pesa STK Push)

---

## Project Structure

```
kadem/
├── backend/              # Node.js Express API
│   ├── config/           # Supabase + PayHero clients
│   ├── middleware/        # JWT auth middleware
│   ├── routes/           # auth, payments, tasks, user, admin
│   └── server.js
├── frontend/             # React app
│   └── src/
│       ├── context/      # AuthContext
│       ├── pages/        # Auth, Dashboard, Admin pages
│       ├── components/   # DashboardLayout
│       └── utils/        # Axios API client
├── supabase/
│   └── schema.sql        # Full DB schema
├── render.yaml           # Render deployment config
└── README.md
```

---

## Step 1 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → your project → **SQL Editor**
2. Paste and run the full contents of `supabase/schema.sql`
3. Copy your:
   - **Project URL** → `SUPABASE_URL`
   - **Service Role Key** (Settings → API) → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2 — Backend Setup (Render)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo, set **Root Directory** to `backend`
4. Add environment variables (from `.env.example`):

```
JWT_SECRET=<generate a strong random string>
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
PAYHERO_USERNAME=xxx
PAYHERO_PASSWORD=xxx
PAYHERO_CHANNEL_ID=xxx
PAYHERO_CALLBACK_URL=https://your-render-url.onrender.com/api/payments/callback
FRONTEND_URL=https://your-site.pages.dev
```

5. Build Command: `npm install`
6. Start Command: `node server.js`

---

## Step 3 — Frontend Setup (Cloudflare Pages)

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) → Create Project
2. Connect GitHub repo, set **Root Directory** to `frontend`
3. Build settings:
   - Build Command: `npm run build`
   - Output Directory: `build`
4. Add environment variable:
   ```
   REACT_APP_API_URL=https://your-render-url.onrender.com/api
   ```

---

## Step 4 — Create Admin User

After deploying, register a user normally then run this SQL in Supabase:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/payments/activate | Pay KES 550 activation |
| POST | /api/payments/buy-package | Buy earning package |
| POST | /api/payments/deposit | Deposit to wallet |
| POST | /api/payments/withdraw-request | Request withdrawal |
| POST | /api/payments/callback | PayHero webhook |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tasks | List tasks |
| POST | /api/tasks/:id/submit | Submit screenshot |
| GET | /api/tasks/my-submissions | My submissions |

### User
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/user/wallet | Wallet + transactions |
| GET | /api/user/referrals | Referral stats |
| GET | /api/user/withdrawals | Withdrawal history |
| PATCH | /api/user/profile | Update profile |

### Admin (admin role required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/dashboard | Stats overview |
| GET/PATCH | /api/admin/users | Manage users |
| GET/POST/PATCH/DELETE | /api/admin/tasks | Manage tasks |
| GET/PATCH | /api/admin/submissions | Review submissions |
| GET/PATCH | /api/admin/withdrawals | Process withdrawals |
| GET | /api/admin/transactions | All transactions |

---

## Earning Formula

```
earning = 20 × views × multiplier
```

| Package | Price | Multiplier | Per View |
|---------|-------|------------|----------|
| Starter | KES 100 | 1x | KES 20 |
| Bronze | KES 500 | 1.5x | KES 30 |
| Silver | KES 1,500 | 2x | KES 40 |
| Gold | KES 2,999 | 3x | KES 60 |

---

## Referral Bonuses

| Event | Bonus |
|-------|-------|
| Registration | KES 50 |
| Activation | KES 100 |
| Package Purchase | KES 150 |

---

## Withdrawal Rules

- Minimum: **KES 1,000**
- Must have **Silver or Gold** package
- Account must be **active**
