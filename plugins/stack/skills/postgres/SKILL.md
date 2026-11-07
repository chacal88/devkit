---
name: postgres
description: Postgres best practices and schema design - query and index performance, connection pooling, RLS and privileges, locking, data access patterns, monitoring, plus PostgreSQL table design (data types, constraints, indexing, partitioning, JSONB). Use when writing, reviewing or optimizing SQL queries, designing or migrating a Postgres schema, or tuning database configuration.
source: Supabase Postgres best practices (rules) and community PostgreSQL schema-design guide
---

# Postgres

Two parts:

- **Best-practice rules** (`rules/`, from Supabase's Postgres guide) — one file per rule, prioritized by impact, each with the incorrect and correct SQL.
- **Schema design** ([references/schema-design.md](references/schema-design.md)) — PostgreSQL table design: data types, constraints, indexing, partitioning and advanced features. Read it when designing or changing tables.

## When to use

- Writing SQL queries or designing schemas
- Adding indexes or optimizing a slow query
- Reviewing database performance issues
- Configuring connection pooling or scaling
- Working with Row-Level Security (RLS)

## How to use

Pick the categories that match the task and read only those rule files. Each rule file contains: why it matters, an incorrect SQL example, a correct SQL example, optional EXPLAIN output or metrics, and Supabase-specific notes when applicable. Category definitions: [rules/_sections.md](rules/_sections.md).

## Rules by priority

### Query Performance (`query-`, CRITICAL)

- [Create Composite Indexes for Multi-Column Queries](rules/query-composite-indexes.md)
- [Use Covering Indexes to Avoid Table Lookups](rules/query-covering-indexes.md)
- [Choose the Right Index Type for Your Data](rules/query-index-types.md)
- [Add Indexes on WHERE and JOIN Columns](rules/query-missing-indexes.md)
- [Use Partial Indexes for Filtered Queries](rules/query-partial-indexes.md)

### Connection Management (`conn-`, CRITICAL)

- [Configure Idle Connection Timeouts](rules/conn-idle-timeout.md)
- [Set Appropriate Connection Limits](rules/conn-limits.md)
- [Use Connection Pooling for All Applications](rules/conn-pooling.md)
- [Use Prepared Statements Correctly with Pooling](rules/conn-prepared-statements.md)

### Security & RLS (`security-`, CRITICAL)

- [Apply Principle of Least Privilege](rules/security-privileges.md)
- [Enable Row Level Security for Multi-Tenant Data](rules/security-rls-basics.md)
- [Optimize RLS Policies for Performance](rules/security-rls-performance.md)

### Schema Design (`schema-`, HIGH)

- [Choose Appropriate Data Types](rules/schema-data-types.md)
- [Index Foreign Key Columns](rules/schema-foreign-key-indexes.md)
- [Use Lowercase Identifiers for Compatibility](rules/schema-lowercase-identifiers.md)
- [Partition Large Tables for Better Performance](rules/schema-partitioning.md)
- [Select Optimal Primary Key Strategy](rules/schema-primary-keys.md)

### Concurrency & Locking (`lock-`, MEDIUM-HIGH)

- [Use Advisory Locks for Application-Level Locking](rules/lock-advisory.md)
- [Prevent Deadlocks with Consistent Lock Ordering](rules/lock-deadlock-prevention.md)
- [Keep Transactions Short to Reduce Lock Contention](rules/lock-short-transactions.md)
- [Use SKIP LOCKED for Non-Blocking Queue Processing](rules/lock-skip-locked.md)

### Data Access Patterns (`data-`, MEDIUM)

- [Batch INSERT Statements for Bulk Data](rules/data-batch-inserts.md)
- [Eliminate N+1 Queries with Batch Loading](rules/data-n-plus-one.md)
- [Use Cursor-Based Pagination Instead of OFFSET](rules/data-pagination.md)
- [Use UPSERT for Insert-or-Update Operations](rules/data-upsert.md)

### Monitoring & Diagnostics (`monitor-`, LOW-MEDIUM)

- [Use EXPLAIN ANALYZE to Diagnose Slow Queries](rules/monitor-explain-analyze.md)
- [Enable pg_stat_statements for Query Analysis](rules/monitor-pg-stat-statements.md)
- [Maintain Table Statistics with VACUUM and ANALYZE](rules/monitor-vacuum-analyze.md)

### Advanced Features (`advanced-`, LOW)

- [Use tsvector for Full-Text Search](rules/advanced-full-text-search.md)
- [Index JSONB Columns for Efficient Querying](rules/advanced-jsonb-indexing.md)
