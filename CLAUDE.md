# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup
npm run setup          # Install deps, generate Prisma client, run migrations

# Development
npm run dev            # Next.js dev server with Turbopack (http://localhost:3000)
npm run dev:daemon     # Dev server in background, logs to logs.txt

# Build & production
npm run build
npm run start

# Linting
npm run lint

# Testing
npm test               # Run all Vitest tests
npx vitest run src/lib/__tests__/file-system.test.ts  # Run a single test file

# Database
npx prisma generate    # Regenerate Prisma client after schema changes
npx prisma migrate dev # Apply migrations
npm run db:reset       # Reset database (destructive)
```

## Environment

Copy `.env` and set `ANTHROPIC_API_KEY`. Without a key the app runs with a mock provider that returns static responses.

## Architecture

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language; Claude generates code that is written to an in-memory virtual file system and rendered live in an iframe.

### Request flow

1. User types in chat → POST `/api/chat` (`src/app/api/chat/route.ts`)
2. Route calls Vercel AI SDK `streamText()` with Claude Haiku 4.5 (or mock provider from `src/lib/provider.ts`)
3. Claude uses two tools to manipulate files:
   - `str_replace_editor` (`src/lib/tools/str-replace.ts`) — create or patch files via string replacement
   - `file_manager` (`src/lib/tools/file-manager.ts`) — create, delete, list files
4. Tool results update the virtual file system (`src/lib/file-system.ts`) and are broadcast via `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`)
5. `PreviewFrame` (`src/components/preview/PreviewFrame.tsx`) detects `App.jsx`/`index.jsx` as the entry point, transpiles JSX with Babel standalone, and renders inside an iframe with import maps
6. For authenticated users, chat messages and file system state are persisted to SQLite via Prisma server actions (`src/actions/`)

### Virtual file system

`src/lib/file-system.ts` is a pure in-memory FS with no disk writes. It is serialized to a JSON string and stored in the `Project.data` column. `FileSystemContext` wraps it in React state so components react to changes.

### AI provider

`src/lib/provider.ts` exports the language model. It uses `@ai-sdk/anthropic` with `claude-haiku-4-5-20251001` when `ANTHROPIC_API_KEY` is set, otherwise falls back to a `MockLanguageModel`.

### Authentication

JWT-based auth via `jose` and `bcrypt` (`src/lib/auth.ts`). Sessions are stored in httpOnly cookies. `src/middleware.ts` protects `/api/*` routes. The app works without auth (anonymous mode); projects are saved only for signed-in users.

### JSX transformation

`src/lib/transform/jsx-transformer.ts` uses `@babel/standalone` to transpile TypeScript + JSX in the browser. It detects missing imports and CSS imports to guide error handling in the preview frame.

### UI layout

`src/app/main-content.tsx` uses `react-resizable-panels` for a three-pane layout:
- Left: chat (`src/components/chat/`)
- Right-top: live preview (`src/components/preview/`)
- Right-bottom: Monaco code editor + file tree (`src/components/editor/`)

### Database schema

The database schema is defined in `prisma/schema.prisma` — reference it whenever you need to understand the structure of data stored in the database. Auto-generated Prisma client lives at `src/generated/prisma/`.

## Code style

Use comments sparingly. Only comment on complex or non-obvious logic.

## Key conventions

- Path alias `@/*` maps to `src/*`
- Shadcn/ui components (New York style, neutral palette, Lucide icons) live in `src/components/ui/`
- Server actions in `src/actions/` use `"use server"` and interact with Prisma
- System prompt for component generation is in `src/lib/prompts/generation.tsx`
- Tests use Vitest + jsdom + `@testing-library/react`; config at `vitest.config.mts`
- `NODE_OPTIONS='--require ./node-compat.cjs'` is prepended to all Next.js commands for Node.js compatibility shims
