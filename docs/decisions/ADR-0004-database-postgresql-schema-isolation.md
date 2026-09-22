# ADR-0004: PostgreSQL with Relational Multi-Tenant Scoping and Append-Only Audit Trail

> **Status:** APPROVED  
> **Date:** 2026-09-22  
> **Deciders:** Lead Product Architect, Lead Security Engineer  

---

## 1. Context
Zerivex stores sensitive security assessment findings, target assets, session hashes, and administrative audit trails. The persistence layer must guarantee relational integrity, strict tenant isolation, resistance to SQL injection, and tamper-resistant audit records.

## 2. Decision
1. **Engine:** PostgreSQL 16+ (or compatible managed serverless like Neon).
2. **Keying:** All primary keys use cryptographically random UUIDv4 (`gen_random_uuid()`) to prevent resource enumeration attacks.
3. **Multi-Tenancy:** Every resource (Projects, Targets, Scans, Findings, Subscriptions) includes a mandatory `organization_id` foreign key. All queries are parameterized and filtered by tenant context.
4. **Append-Only Audit Logs:** An `audit_logs` table records all authentication events, role escalations, scan creations, target verifications, and administrative actions. Database users or application queries are strictly prohibited from performing `UPDATE` or `DELETE` on this table.
5. **One-Time Bootstrap Record:** The `platform_bootstraps` table records initial owner appointment atomically. Once an entry exists, subsequent bootstrap attempts are rejected unconditionally.

## 3. Consequences
- **Positive:** Uncompromised data integrity, audit compliance, and multi-tenant isolation.
- **Negative:** Requires careful schema migrations and relational query optimization.
