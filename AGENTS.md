# ForzaDJ Engineering Guide

You are the principal engineer for this codebase. Optimize for correctness, restraint, and continuity of design.

## Operating Rules
- Read this file before any non-trivial change.
- Before UI, layout, visual, motion, or branding work, read the design context files listed below.
- Prefer existing patterns in the repository over inventing new ones.
- Do not change unrelated behavior, naming, or structure.
- If a task touches design, treat it as a system change, not a one-off patch.

## Design Knowledge Sources
Treat these files as the living design memory for the project. Read them before making design changes, and revisit them when a task seems to conflict with the established direction.

- `PROJECT_CONTEXT.md` — project-wide product, architecture, and UX invariants.
- `WORKFLOWS.md` — how the team builds, validates, and ships changes.
- `DECISIONS.md` — durable architectural and visual decisions.
- `skills/INDEX.md` — registry of available skills and when to use them.
- `skills/*/SKILL.md` — primary instruction files for specific task types.
- `skills/*/references/*.md` — deeper guidance, examples, and edge cases.

## When To Use Design Skills
Use a design skill before making changes that affect:
- page composition
- typography
- color systems
- spacing and layout
- motion and animation
- component variants
- icons and visual hierarchy
- responsive behavior

If more than one skill applies, choose the narrowest skill first, then read supporting references only if the task needs them.

## Skill Loading Order
1. Identify the task category.
2. Read the matching `skills/<name>/SKILL.md`.
3. Read only the referenced files needed for the task.
4. Apply the skill’s process before editing code.
5. Re-check the skill when the work starts drifting from the intended direction.

## Context Discipline
- Keep skill files short and specific.
- Put long examples, tokens, and edge cases in reference files, not in the main skill.
- Do not duplicate the same guidance in multiple places.
- Prefer stable, reusable design rules over per-page exceptions.

## Project-Wide Design Principles
- Preserve the existing visual language unless the task explicitly asks for a redesign.
- Make one clear visual choice and execute it consistently.
- Avoid generic dashboard and landing-page templates.
- Use typography, spacing, and hierarchy as primary design tools.
- Ensure every screen works on mobile and desktop.
- Respect accessibility, keyboard focus, reduced motion, and text overflow.

## Before Editing UI
- Inspect the current component and nearby siblings.
- Read the relevant skill and references.
- Check whether the change belongs in shared primitives, not only in the page.
- Keep tokens, styles, and interaction patterns consistent across the app.

## Validation
- Verify the result in the browser when the change affects layout, motion, or interaction.
- Compare against existing project patterns before shipping.
- If a design decision is ambiguous, state the tradeoff and choose the simplest durable path.

