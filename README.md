# ReachInbox — Full-Stack Email Job Scheduler

A production-grade email scheduling and dispatch system built for the **ReachInbox Software Development Intern Assignment** using **TypeScript**, **Express.js**, **BullMQ + Redis**, **PostgreSQL + Prisma ORM**, **Elasticsearch**, **Ethereal Email (Multi-Sender Fake SMTP)**, **Google OAuth 2.0**, **Slack OAuth 2.0**, and **React + Tailwind CSS**.

---

## 1. System Architecture Overview

```mermaid
flowchart LR
    subgraph Frontend ["Frontend (React + TypeScript + Tailwind CSS)"]
        Login["LoginPage.tsx\n(Real Google OAuth 2.0)"]
        Dash["DashboardPage.tsx\n(Scheduled & Sent Tabs + Search)"]
        Compose["ComposeEmailView.tsx\n(CSV Lead Parser, Delay, Hourly Limit)"]
    end

    subgraph Backend ["Backend (Express + TypeScript)"]
        API["REST API\n(/api/auth, /api/emails, /api/senders, /api/slack)"]
        BullBoard["BullMQ Dashboard\n(/admin/queues)"]
        Scheduler["BullMQ Scheduler & Worker\n(Concurrency + Min Delay + Rate Limiter)"]
        Recovery["Restart Persistence Manager\n(Crash Recovery & Idempotency)"]
    end

    subgraph Infrastructure ["Persistence & External Services"]
        PG[("PostgreSQL\n(Prisma ORM)")]
        Redis[("Redis\n(BullMQ Delayed Jobs & Hourly Counters)")]
        ES[("Elasticsearch\n(Email Indexing & Search)")]
        SMTP["Ethereal Email\n(Multi-Sender SMTP)"]
        Slack["Slack API\n(OAuth 2.0 + Live Rate-Limit Alert)"]
    end

    Login --> API
    Compose --> API
    Dash --> API
    API --> PG
    API --> ES
    API --> Redis
    Redis --> Scheduler
    Recovery --> PG
    Recovery --> Redis
    Scheduler --> PG
    Scheduler --> ES
    Scheduler --> SMTP
    Scheduler --> Slack
```

### A. How Scheduling Works (Zero Cron Jobs)
1. When a user schedules single or bulk (CSV-uploaded) emails via `POST /api/emails/schedule`:
   - Each recipient email is saved in **PostgreSQL** via Prisma ORM (`email_jobs` table with `status = 'SCHEDULED'`).
   - Each email document is indexed into **Elasticsearch** (`reachinbox_emails` index).
   - Each email is scheduled in **BullMQ** (`reachinbox-email-scheduler` queue) as a **delayed job** using a deterministic `jobId = emailJob.id`:
     ```ts
     const delayMs = Math.max(0, new Date(scheduledAt).getTime() - Date.now());
     await queue.add('send-email', payload, { jobId: emailJob.id, delay: delayMs });
     ```
2. **No cron jobs (`node-cron`, `agenda`, or OS `crontab`) are used anywhere.** BullMQ's Redis delayed sorted set wakes the worker at the exact target timestamp.

### B. How Persistence on Server Restart & Idempotency Are Handled
1. **Dual Persistence Layer**:
   - **PostgreSQL (Prisma)** is the relational source of truth for every `EmailJob` (`SCHEDULED`, `PROCESSING`, `RATE_LIMITED`, `SENT`, `FAILED`).
   - **Redis** persists delayed BullMQ job state across restarts.
2. **Startup Crash & Restart Recovery (`backend/src/queue/persistence/restartRecovery.ts`)**:
   - Whenever the backend server starts or restarts, `recoverPendingJobsOnStartup()` queries PostgreSQL for all jobs in `SCHEDULED`, `PROCESSING`, or `RATE_LIMITED` status.
   - For each pending job, it checks if the job is already present in BullMQ (`queue.getJob(emailJobId)`). If missing, it re-schedules the job with the remaining delay `Math.max(0, new Date(job.scheduledAt).getTime() - Date.now())`.
3. **Strict Idempotency**:
   - Deterministic `jobId = emailJob.id` prevents duplicate jobs in BullMQ.
   - Inside `processEmailJob()`, the worker checks `if (restartPersistenceManager.isAlreadySent(jobRecord)) return;` before dispatching via SMTP. Even if a worker restarts mid-flight, an already `SENT` email is **never sent twice**.

### C. How Rate Limiting, Minimum Delay & Worker Concurrency Are Implemented
1. **Configurable Worker Concurrency (`WORKER_CONCURRENCY=5`)**:
   - Configured in `backend/src/queue/concurrency/concurrencyAndDelay.ts` and passed to the BullMQ `Worker` instance so up to 5 jobs can be processed concurrently.
2. **Minimum Delay Between Individual Emails (`MIN_DELAY_BETWEEN_EMAILS_MS=2000`)**:
   - We enforce a minimum **2-second delay (`2000ms`)** between individual email sends per sender (`enforceMinimumDelayBetweenSends`), or the campaign's custom `delayBetweenEmailsSeconds` if higher, mimicking SMTP provider throttling.
3. **Per-Sender Hourly Rate Limiting (`MAX_EMAILS_PER_HOUR_PER_SENDER=50`)**:
   - Implemented in `backend/src/queue/rate-limiting/hourlyRateLimiter.ts`.
   - Uses an atomic Redis counter key `ratelimit:{senderId}:{YYYY-MM-DD-HH}` (`INCR` + `EXPIRE 3600`), safe across multiple concurrent worker instances.
   - **When `currentCount > hourlyLimit`**:
     - Jobs are **never dropped or permanently failed**.
     - The rate limiter computes the next available slot in the next UTC hour window while preserving FIFO order:
       ```ts
       const overflowIndex = Math.max(0, currentCount - limit - 1);
       const nextAvailableTimestampMs = startOfNextHourMs + overflowIndex * spacingMs;
       ```
     - The job's database status is updated to `RATE_LIMITED` with the new `scheduledAt` timestamp, and BullMQ reschedules the job via `await job.moveToDelayed(nextAvailableTimestampMs, token)`.
4. **Live Slack Notification on Rate Limit Hit (`backend/src/services/slack.service.ts`)**:
   - Clicking **Connect Slack** in the dashboard header redirects the user through the real Slack OAuth 2.0 flow (`/api/slack/oauth/start` → `https://slack.com/oauth/v2/authorize` → `/api/slack/oauth/callback`), storing the user's Slack token/webhook in PostgreSQL.
   - When a sender's hourly limit is reached, an atomic Redis lock (`SET slack_notified:{senderId}:{YYYY-MM-DD-HH} 1 EX 3600 NX`) ensures a **live Slack alert** is sent immediately to the user's Slack channel once per hour window.
   - Clicking **Slack Connected (Disconnect)** (`POST /api/slack/disconnect`) clears the token so future rate-limit hits safely skip notifying without crashing; reconnecting immediately resumes notifications without a redeploy.

---

## 2. Behavior Under Load (1,000+ Emails Scheduled Simultaneously)

When 1,000+ emails are scheduled for the same `startTime` with e.g. `delayBetweenEmailsSeconds = 2` and `hourlyLimit = 50`:
1. **Staggered Enqueueing**: During `POST /api/emails/schedule`, each recipient `i` is persisted in PostgreSQL and added to BullMQ with an initial staggered target time of `baseStartTime + i * delayMs`.
2. **Non-Blocking Overflow Rescheduling**: In `bullmqScheduler.ts`, the worker checks `hourlyRateLimiter.checkAndIncrementSenderWindow()` **before** sleeping for the 2-second inter-email throttle:
   - Emails `1..50` pass the atomic Redis counter check, enforce the 2-second minimum delay between sends, and dispatch via Ethereal SMTP.
   - Email `51` increments the Redis counter to `51 > 50`, triggers the **live Slack rate-limit notification**, and immediately moves to the next hour window (`startOfNextHourMs`) via `job.moveToDelayed(...)`.
   - Emails `52..1000` immediately reschedule into the next available hourly window (`startOfNextHourMs + (count - limit - 1) * delayMs`) in milliseconds without blocking worker threads on the 2-second SMTP delay, preserving order with zero dropped jobs.

---

## 3. List of Features Implemented (Mapped to Folder Structure)

### Backend (`backend/`)
| Feature / Requirement | Implementation Path |
| :--- | :--- |
| **Prisma Relational Schema** (`User`, `SenderAccount`, `EmailJob`, `RateLimitWindow`) | [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) |
| **Core Scheduler (BullMQ Delayed Jobs, No Cron)** | [`backend/src/queue/scheduler/bullmqScheduler.ts`](backend/src/queue/scheduler/bullmqScheduler.ts) |
| **Persistence on Restart & Idempotency Guard** | [`backend/src/queue/persistence/restartRecovery.ts`](backend/src/queue/persistence/restartRecovery.ts) |
| **Hourly Rate Limiting per Sender (Redis Atomic Counters)** | [`backend/src/queue/rate-limiting/hourlyRateLimiter.ts`](backend/src/queue/rate-limiting/hourlyRateLimiter.ts) |
| **Worker Concurrency & Minimum Delay Between Sends** | [`backend/src/queue/concurrency/concurrencyAndDelay.ts`](backend/src/queue/concurrency/concurrencyAndDelay.ts) |
| **Live BullMQ Queue Dashboard (`/admin/queues`)** | [`backend/src/queue/dashboard/bullBoardDashboard.ts`](backend/src/queue/dashboard/bullBoardDashboard.ts) |
| **Multi-Sender Ethereal Email (SMTP) Service** | [`backend/src/services/smtp.service.ts`](backend/src/services/smtp.service.ts) |
| **Elasticsearch Indexing & Search Service** | [`backend/src/services/elasticsearch.service.ts`](backend/src/services/elasticsearch.service.ts) |
| **Live Slack OAuth 2.0 & Rate-Limit Notification Service** | [`backend/src/services/slack.service.ts`](backend/src/services/slack.service.ts) |
| **Prisma Domain Repositories (`user`, `sender`, `emailJob`, `rateLimit`)** | [`backend/src/db/repositories/`](backend/src/db/repositories/) |
| **Express Controllers & Modular Routes** | [`backend/src/controllers/`](backend/src/controllers/) & [`backend/src/routes/`](backend/src/routes/) |

### Frontend (`frontend/`)
| Feature / Requirement | Implementation Path |
| :--- | :--- |
| **Real Google OAuth 2.0 Login Page (Matches Figma)** | [`frontend/src/pages/LoginPage.tsx`](frontend/src/pages/LoginPage.tsx) |
| **Main Dashboard, Header (User Profile, Search, Slack, Logout) & Sidebar** | [`frontend/src/pages/DashboardPage.tsx`](frontend/src/pages/DashboardPage.tsx), [`frontend/src/components/layout/`](frontend/src/components/layout/) |
| **Compose Email View + CSV/TXT Lead Parser & Counter** | [`frontend/src/components/compose/ComposeEmailView.tsx`](frontend/src/components/compose/ComposeEmailView.tsx), [`csvLeadParser.ts`](frontend/src/components/compose/csvLeadParser.ts) |
| **Scheduled & Sent Emails Tables + Full Email Detail View** | [`frontend/src/components/tables/ScheduledEmailsTable.tsx`](frontend/src/components/tables/ScheduledEmailsTable.tsx), [`SentEmailsTable.tsx`](frontend/src/components/tables/SentEmailsTable.tsx), [`EmailDetailModal.tsx`](frontend/src/components/tables/EmailDetailModal.tsx) |
| **Reusable DRY UI Components (`Button`, `Input`, `Badge`, `Modal`, `EmptyState`, `Toast`)** | [`frontend/src/components/ui/`](frontend/src/components/ui/) |
| **Typed API Service & TypeScript Interfaces** | [`frontend/src/services/api.ts`](frontend/src/services/api.ts), [`frontend/src/types/index.ts`](frontend/src/types/index.ts) |

---

## 4. Setup & Running Instructions

### Prerequisites
- **Node.js** `v18+` (tested on `v24`)
- **PostgreSQL** (via Docker Compose or Supabase/Neon)
- **Redis** (via Docker Compose or Upstash/local Redis)
- **Elasticsearch** (via Docker Compose on `http://localhost:9200`)

### 1. Start Infrastructure (Optional if using Cloud DB/Redis)
```bash
docker compose up -d
```

### 2. Configure Environment Variables

#### Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:
```env
PORT=4000
FRONTEND_URL=http://localhost:5173

# PostgreSQL (Local Docker or Supabase Session Pooler URI)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reachinbox_scheduler

# Redis (Local Docker or Upstash rediss:// URI)
REDIS_URL=redis://127.0.0.1:6379

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=reachinbox_emails

# Throughput, Concurrency & Rate Limiting (Configurable via env — no hardcoding)
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=50

# Ethereal Email SMTP (https://ethereal.email -> Create Ethereal Account, or leave blank for auto-provisioning)
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=your_ethereal_user@ethereal.email
ETHEREAL_PASS=your_ethereal_password

# Google OAuth 2.0 (https://console.cloud.google.com/apis/credentials)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Slack OAuth 2.0 (https://api.slack.com/apps -> Redirect URI: http://localhost:4000/api/slack/oauth/callback)
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:4000/api/slack/oauth/callback
SLACK_DEFAULT_WEBHOOK_URL=
```

#### Frontend (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

### 3. Run the Backend & BullMQ Worker
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```
- **REST API**: `http://localhost:4000/api`
- **Live BullMQ Dashboard**: `http://localhost:4000/admin/queues`
- **Health & Config Endpoint**: `http://localhost:4000/api/health`

### 4. Run the Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```
- **Dashboard UI**: `http://localhost:5173`

---

## 5. Assumptions, Shortcuts & Trade-offs

1. **Fixed UTC Hour Windows vs. Sliding Rolling Window**:
   - *Trade-off*: Hourly rate limits use fixed UTC hour buckets (`ratelimit:{senderId}:{YYYY-MM-DD-HH}`) with a `3600s` TTL rather than a per-timestamp Lua sliding log. Fixed hour buckets use `O(1)` memory per sender in Redis and make computing the exact `startOfNextHourMs` reschedule timestamp deterministic under high concurrency.
2. **Co-located Express API & BullMQ Worker Entrypoint**:
   - *Shortcut*: For streamlined local evaluation and single-command startup (`npm run dev`), the Express API and BullMQ Worker boot together in `backend/src/index.ts` using separate `ioredis` connections as required by BullMQ. Because all queue state and rate-limit counters reside in Redis and PostgreSQL, workers can be scaled out as separate processes without code changes.
3. **Multi-Sender Ethereal Auto-Provisioning**:
   - *Assumption*: Upon first Google login, the backend automatically provisions the user's `.env` Ethereal account plus additional test sender accounts via `nodemailer.createTestAccount()` so multi-sender scheduling and per-sender rate limits can be tested immediately from the Compose dropdown.
