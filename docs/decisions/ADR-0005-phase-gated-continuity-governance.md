# ADR-0005: Phase-Gated Engineering Governance & AI Agent Continuity Protocol

> **Status:** APPROVED  
> **Date:** 2026-09-22  
> **Deciders:** Lead Product Architect, Lead Security Engineer  

---

## 1. Context
Complex cybersecurity SaaS platforms built with AI assistance often suffer from loss of context, skipped security validations, simulated findings, and chaotic phase drift. A rigid governance protocol is mandatory to ensure every feature is verified, documented, and explicitly approved by the platform owner before progressing.

## 2. Decision
1. **Phase-Gated Execution:** Work is strictly divided into distinct phases (Phase 0 through Phase 15). An AI agent must never automatically advance to the next phase without explicit owner review and approval.
2. **Phase Status Vocabulary:** Only standardized statuses are permitted: `NOT_STARTED`, `PLANNED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `TESTING`, `READY_FOR_REVIEW`, `COMPLETE`, `DEPRECATED`.
3. **Dual Continuity System:**
   - `ZERIVEX_CONTEXT.md` (root): Long-term architectural memory, tech stack state, known security risks, environment state.
   - `HANDOFF.md` (root): Short-term task state, active files, failing tests, immediate next steps.
4. **Context Exhaustion Rule:** When context limits approach, prioritize recording state, running tests, updating continuity files, and creating clean git commits over starting new features.
5. **No Fake Security:** Never claim a security control exists without implementation and tests. Never generate fake vulnerabilities.
6. **Owner Authority:** The platform owner has sole authority over architecture changes, phase sign-offs, and security compromises.

## 3. Consequences
- **Positive:** Guarantees zero regression across AI agent sessions, total transparency for the owner, and rock-solid security verification.
- **Negative:** Enforces deliberate, disciplined checkpoints rather than rapid unverified code generation.
