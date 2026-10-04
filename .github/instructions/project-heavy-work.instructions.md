---
applyTo: "src/**, prisma/**, test/**, package.json, README.md"
description: "Use when handling large backend changes, multi-file refactors, Prisma schema updates, NestJS services, workers, auth flows, or debugging production issues in this repository."
---

# Heavy backend task instructions

You are working in a NestJS + Prisma + BullMQ backend for an inspection and surveillance platform.

## Operating rules

- Start by locating the root cause, not by patching blindly.
- Read the relevant files narrowly first, then expand only if required.
- Prefer the existing project patterns already used in the same module.
- Keep changes minimal, explicit, and traceable.
- Do not add speculative abstractions or unnecessary wrappers.
- If a change affects the Prisma schema, inspect the corresponding models, migrations, and service usage before editing.
- If a change affects workers or queues, check both the producer and the consumer side.
- If a change touches auth or JWT behavior, verify guards, decorators, and controller usage together.

## Project-specific expectations

- Use NestJS module/service patterns already present in `src/modules/**`.
- Keep Prisma access centralized through the existing Prisma service patterns.
- For worker tasks, confirm whether they are registered in the worker module and scheduled in the queue setup.
- Preserve the repository’s existing naming conventions and API structure.
- Validate with the smallest relevant command, typically a focused Jest run or a targeted build/lint check.

## Execution pattern

1. Reproduce or identify the bug and narrow the impacted area.
2. Inspect the exact module/service, relevant DTOs, and any Prisma model usage.
3. Form one concrete hypothesis and patch only that root cause.
4. Run the narrowest usable validation.
5. Summarize the fix, the files changed, and the verification evidence.

## Validation

Before reporting success, run at least one proof command relevant to the change:

- `npm test -- --runInBand` for focused Jest validation when a unit test is available
- `npm run build` for compilation safety on TypeScript changes
- `npm run lint` for code-quality checks when appropriate

Do not claim a fix is complete without fresh evidence from the relevant validation output.
