# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
Riri AI is a Telegram Mini App — visual CRM for content creators (Instagram Reels/Shorts). React 18 + TypeScript + Vite frontend with Vercel serverless API functions in `/api/*.js`.

### Dev commands
See `package.json` scripts:
- `npm run dev` — Vite dev server on port 3000
- `npm run build` — `tsc && vite build`
- `npm run lint` — ESLint (note: codebase has pre-existing lint errors/warnings)

### Key architecture notes
- **Frontend only runs locally** via `npm run dev`. The `/api/*` serverless functions require Vercel CLI (`vercel dev`) or deployment to Vercel.
- **Supabase client gracefully degrades** without credentials — creates a mock client in `src/utils/supabase.ts`, so the app renders without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- **Production app**: https://ririrai.vercel.app — use this for end-to-end testing since it has all backend services connected.
- **No test framework** is configured (no Jest/Vitest/Playwright). Testing is manual only.
- **No Docker** — no containers needed for local dev.

### Environment variables
Copy `.env.example` to `.env`. Required secrets for full functionality: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RAPIDAPI_KEY`. See `.env.example` for the complete list.
