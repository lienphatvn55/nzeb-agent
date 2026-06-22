# Contributing

## Setup

```bash
npm install
cp .env.example .env.local   # then fill ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

## Before opening a PR

Run the same checks CI runs and make sure they pass:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Guidelines

- The decision engine (`lib/engine/`) is the scientific core — any change to its
  numbers must come with/keep passing tests in `tests/`.
- Keep the agent grounded: every figure in the recommendation must trace back to
  a tool result; the LLM must not invent numbers.
- Don't commit secrets. `.env*` is gitignored — use `.env.example` for new vars.
- Production must use a genuine Anthropic key + model (no third-party proxies).
