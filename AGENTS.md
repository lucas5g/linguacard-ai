# AGENTS

## Stack And Shape
- Single-package Next.js 15 app-router app; no monorepo tooling.
- Main UI lives in `app/page.tsx` as one large client component that owns card CRUD, quiz state, and queue persistence.
- Server routes are `app/api/cards/route.ts`, `app/api/cards/[id]/route.ts`, and `app/api/quiz-queue/route.ts`.
- Shared server logic is in `src/lib/quizQueue.ts`, Prisma client setup is in `src/lib/prisma.ts`, and OpenRouter calls are in `src/services/llmService.ts`.

## Commands
- Install deps: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Non-interactive typecheck: `npx tsc --noEmit`
- Prisma schema check: `npm exec prisma validate`

## Verification Reality
- `npm run lint` is not a reliable check here. It runs `next lint`, which is deprecated and currently opens an interactive ESLint setup prompt because no ESLint config is committed.
- `next.config.js` sets `typescript.ignoreBuildErrors = true`, so `npm run build` does not catch TypeScript errors. Run `npx tsc --noEmit` yourself after TS edits.
- There is no test suite or CI workflow in the repo right now.

## Env And Data
- The only env vars validated by code are `DATABASE_URL` and `OPENROUTER_API_KEY` in `src/env.ts`. Server code will fail fast if either is missing.
- Prisma uses PostgreSQL (`prisma/schema.prisma`). No migrations are checked in; only the schema is present.
- Prisma Client is generated automatically on `postinstall` and again during `npm run build`.

## Repo-Specific Gotchas
- Tailwind is v4-style and configured through `app/globals.css` plus `postcss.config.js`; there is no `tailwind.config.*` file.
- Quiz queue ordering is persisted in the `QuizQueueItem` table, not derived only in memory. If card creation/deletion or quiz flow changes, check `src/lib/quizQueue.ts` and `/api/quiz-queue` together.
