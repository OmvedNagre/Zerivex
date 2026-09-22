# ADR-0006: Canonical PostgreSQL Persistence Engine (Exclusion of SQLite for Production)

> **Status:** APPROVED  
> **Date:** 2026-09-22  
> **Deciders:** Lead Product Architect, Lead Security Engineer  

---

## 1. Context
Dual-database architectures that attempt to treat SQLite and PostgreSQL interchangeably often introduce subtle behavioral drift, concurrency locking bottlenecks, incompatible JSON query semantics, and accidental deployment of SQLite to production environments where connection pooling and row-level locking are mandatory.

## 2. Decision
1. **PostgreSQL is the sole canonical persistence engine for Zerivex.**
2. Production environments will use managed PostgreSQL (e.g. Neon Serverless PostgreSQL) with SSL enforcement (`sslmode=require`) and connection pooling.
3. Local development and automated integration testing will run against local PostgreSQL instances (e.g. Docker container or local service), using standard SQL migrations and identical schema constraints.
4. SQLite is explicitly rejected as a persistent backend to eliminate behavioral drift, missing concurrency controls, and accidental production leakage.

## 3. Consequences
- **Positive:** Zero environment divergence between development, CI testing, and production; native support for UUIDv4, JSONB queries, row-level locks, and strict foreign key cascades.
- **Negative:** Requires developers to have PostgreSQL available locally (standard via Docker `postgres:16-alpine`).
