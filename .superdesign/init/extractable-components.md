# Extractable components

## Shell
- Source: `apps/web/src/Shell.tsx`
- Category: layout
- Description: Studio sidebar, project workflow rail, command bar, account footer.
- Extractable props: `projectName`, `workflowStages`, `orgName`, `sessionEmail`.
- Hardcoded: ULTIDA identity and top-level studio labels.

## Button
- Source: `apps/web/src/components/ui/primitives.tsx`
- Category: basic
- Description: Accessible button with default, outline, ghost, primary and secondary variants.
- Extractable props: `variant`, `size`, `icon`, `disabled`.

## Card and Badge
- Source: `apps/web/src/components/ui/primitives.tsx`
- Category: basic
- Description: Shared card and status primitives used by workspaces.
- Extractable props: `tone`, `variant`, `className`.
