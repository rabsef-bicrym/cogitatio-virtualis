# COGITATIO VIRTUALIS - Virtualis Terminal

Virtualis Terminal is the Next.js frontend for COGITATIO VIRTUALIS: a CRT-style
AI terminal for document exploration, resume navigation, and portfolio chat.

## Status

- Boot sequence generation is active, with Claude-backed generation and local
  fallback messages.
- Chat is routed through session-scoped threads, server-sent events, typed
  Claude tool dispatch, and vector search against the Python backend.
- Error handling uses visual terminal states plus recoverable slash-command
  fallback behavior.
- Automated checks are active: ESLint, Prettier, TypeScript, Vitest, Playwright,
  and production build.

## Architecture

### Terminal Surface

- `components/Terminal/VirtualisTerminal.tsx` orchestrates the terminal
  experience.
- `components/RoomScene/RoomScene.tsx` owns the desktop room, CRT housing, and
  composed screen effects.
- `components/MobileDenial/MobileDenial.tsx` owns the intentional mobile
  replacement surface.
- Terminal controllers isolate boot, chat, event queue, and state transitions.
- CSS Modules and scoped global styles provide the room, CRT scanline, glow,
  and layout effects.

### Chat API

The public chat route is intentionally thin:

- `pages/api/chat/threads.ts` applies session middleware and delegates to
  `lib/chat/chatRoute.ts`.
- `lib/chat/threadStore.ts` owns Prisma persistence.
- `lib/chat/sseWriter.ts` owns server-sent event framing.
- `lib/chat/messageCodec.ts` owns Claude message encoding and reply repair.
- `lib/chat/claudeToolLoop.ts` owns Claude tool-loop orchestration.
- `lib/chat/claudeToolDispatch.ts` dispatches Claude tool calls through typed
  Zod input objects.
- `lib/chat/hardCommands.ts` handles human slash commands.

### Backend Contract

- `lib/api/vector.ts` is the frontend client for the Python vector API.
- `lib/api/document-codec.ts` parses the cross-language document contract before
  frontend code consumes vector responses.
- Python document metadata uses the canonical `sub_type` field for "other"
  documents.

## Technical Stack

- Next.js 16
- React 19
- TypeScript 6
- Prisma 7 with Postgres and `@prisma/adapter-pg`
- Anthropic TypeScript SDK
- `crt-terminal`
- Zod
- ESLint 9 flat config
- Prettier 3
- Vitest
- Playwright

## API Endpoints

```text
GET  /api/boot/sequence   Generate boot and haiku text
GET  /api/chat/threads    Read the current session thread
POST /api/chat/threads    Stream chat or slash-command responses
```

## Commands

```bash
Power User Commands:
/search <type> <text>  - Vector search
  <type>: none, query, document
/exp <type>            - Experience documents
  <type>: list, years, skills
/other <subtype>      - Other document types
  <subtype>: cover-letter, publication-speaking, recommendation, thought-leadership
/project <command>     - Project operations
  <command>: list, type <subtype>, active
/resume                - Start resume generator

System Commands:
/clear                 - Clear terminal
/status                - Show system status
/history [count]       - Display command history
/help                  - Display help
```

## Development

### Prerequisites

```bash
Node.js >= 20
npm >= 10
```

### Setup

```bash
npm install
npm run db:generate
npm run dev
```

The Python vector API should be running separately when exercising live document
retrieval. By default the frontend expects it at `http://localhost:8000`.

### Verification

```bash
npm run format
npm run lint
npm run build:ts -- --noEmit
npm run test:unit
npm run test:e2e
npm run build
```

The full local gate is:

```bash
npm run check
```

## Environment Variables

```bash
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
VOYAGE_API_KEY=pa-xxxx
VOYAGE_MODEL=voyage-3
ANTHROPIC_API_KEY=sk-ant-xxxx
ANTHROPIC_CHAT_MODEL=claude-sonnet-4-6
ANTHROPIC_BOOT_MODEL=claude-haiku-4-5
ANTHROPIC_HAIKU_MODEL=claude-haiku-4-5
PORT=3000 # Optional
```

Model defaults are centralized in `lib/api/anthropic-config.ts`. The main chat
path defaults to Sonnet 4.6; boot and haiku generation default to Haiku 4.5.
Each call path also supports optional `ANTHROPIC_*_MAX_TOKENS` and
`ANTHROPIC_*_TEMPERATURE` overrides.

## Project Structure

```text
virtualis-terminal/
├── components/Terminal/     Terminal UI, controllers, handlers, styles
├── lib/api/                 Anthropic config, vector client, codecs
├── lib/chat/                Chat route modules and typed tool dispatch
├── lib/fallbacks/           Boot and haiku fallback content
├── lib/mock/                Mock development responses
├── lib/prompts/             Boot, haiku, and chat prompts
├── lib/threads/             Prisma session helpers
├── pages/                   Next.js pages and API route adapters
├── prisma/                  Prisma schema and migrations
├── styles/                  Global styles
├── tests/e2e/               Playwright coverage
├── tests/unit/              Vitest coverage
└── types/                   Shared TypeScript interfaces
```

## Code Style

- Strict TypeScript
- ESLint flat config with zero warnings
- Prettier formatting
- Focused unit tests for codecs and tool dispatch
- Playwright coverage for the primary terminal surface
