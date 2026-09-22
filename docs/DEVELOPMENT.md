# Zerivex Development Guide & Phase Protocol

---

## 1. Development Principles
- **Security Correctness over Visual Completion:** Features are only done when backed by server-side validation, tests, and documentation.
- **Phase-Gated Development:** Never advance to the next phase without running full test suites, typechecks, builds, updating continuity files, and receiving explicit owner sign-off.
- **Git Discipline:** Clean, descriptive commits following Conventional Commits (`feat(auth): ...`, `test(ssrf): ...`, `phase(1): ...`).

---

## 2. Phase-Gated Lifecycle
Each phase adheres to this strict sequence:
1. **PLAN:** Verify requirements against current architecture and ADRs.
2. **IMPLEMENT:** Write clean, typed, modular code with runtime validation.
3. **TEST:** Unit tests and edge cases.
4. **SECURITY TEST:** Negative attack testing (SSRF, IDOR, privilege escalation).
5. **DOCUMENT:** Update relevant markdown docs.
6. **UPDATE CONTEXT:** Update `ZERIVEX_CONTEXT.md` and `HANDOFF.md`.
7. **COMMIT:** Meaningful git commit(s).
8. **PHASE REVIEW:** Mark `READY_FOR_REVIEW`, produce Phase Completion Report, and STOP.

---

## 3. Standard Phase Status Vocabulary
- `NOT_STARTED`
- `PLANNED`
- `IN_PROGRESS`
- `BLOCKED`
- `IMPLEMENTED`
- `TESTING`
- `READY_FOR_REVIEW`
- `COMPLETE`
- `DEPRECATED`

---

## 4. Local Development Commands (Planned for Phase 1+)
- `npm run dev`: Start Next.js development server.
- `npm test`: Run Vitest test suite.
- `npm run test:security`: Run security integration tests.
- `npm run typecheck`: Run TypeScript compiler check.
- `npm run build`: Production Next.js build.
