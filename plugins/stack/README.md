# devkit-stack

Technology references that Claude loads when the work touches that technology. Install only the pack where the stack matches; every installed skill's description costs context on every turn.

```bash
claude plugin install devkit-stack@devkit --scope project
```

Run at the project root, or add the pack to the project's `.claude/settings.json` (see [getting-started](../../docs/getting-started.md#1-opt-the-project-in)).

Most of these skills are adapted from public, permissively licensed sources. See [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).

## Assets

<!-- catalog:begin -->
**Skills** (invoke with `/<name>` or let Claude pick them by description)

| Skill | What it does / when to use |
|---|---|
| [`neon-postgres`](skills/neon-postgres/SKILL.md) | Patterns for Neon serverless Postgres - pooled vs direct connections, Prisma and Drizzle integration, the serverless driver, database branching for preview environments and CI. Use when the project uses Neon, or when the user mentions serverless Postgres, database branching, per-preview databases, or Neon connection pooling. |
| [`postgres`](skills/postgres/SKILL.md) | Postgres best practices and schema design - query and index performance, connection pooling, RLS and privileges, locking, data access patterns, monitoring, plus PostgreSQL table design (data types, constraints, indexing, partitioning, JSONB). Use when writing, reviewing or optimizing SQL queries, designing or migrating a Postgres schema, or tuning database configuration. |
| [`react-performance`](skills/react-performance/SKILL.md) | Performance rules for React and Next.js from Vercel - eliminating waterfalls, bundle size, server-side rendering and caching, client data fetching, re-renders, rendering and JavaScript hot paths. Use when writing React components or Next.js pages, implementing data fetching, optimizing bundle size or load time, or reviewing React code for performance issues. |
| [`saas-multi-tenant`](skills/saas-multi-tenant/SKILL.md) | Designs and implements multi-tenant SaaS data isolation in PostgreSQL and TypeScript - shared-schema vs schema- or database-per-tenant, row-level security, tenant-scoped queries, and safe cross-tenant admin access. Use when building a SaaS where customers share a database, adding tenant_id to a single-tenant app, or when the user asks about tenant isolation or data leakage between tenants. |
| [`threat-model`](skills/threat-model/SKILL.md) | Repository-grounded threat modeling that enumerates trust boundaries, assets, attacker capabilities, abuse paths and mitigations, and writes a concise Markdown threat model. Use only when the user explicitly asks to threat model a codebase or path, enumerate threats or abuse paths, or do AppSec threat modeling - not for general architecture summaries, code review or non-security design. |
| [`vitest`](skills/vitest/SKILL.md) | Reference for Vitest, the Vite-powered test framework with a Jest-compatible API - config, CLI, test/describe/expect APIs, hooks, mocking, snapshots, coverage, fixtures, concurrency, filtering, environments and type testing. Use when writing or debugging Vitest tests, mocking modules or timers, configuring coverage, or setting up Vitest projects. |
<!-- catalog:end -->
