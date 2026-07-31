# Tridorian — UI Agent Instructions

Use `tridorian-agent-theme-v3.json` as the source of truth when generating or revising Tridorian web-app interfaces.

## Operating rules

1. Consume semantic tokens, never raw palette values inside components.
2. Prioritize accessibility, information hierarchy, responsiveness, brand consistency, then polish.
3. Default to a calm light workspace with deep-forest navigation. Use a fully dark canvas for focused AI workspaces, data consoles, and premium moments.
4. Treat luminous green as a scarce action signal. Use violet for AI, automation, beta, and informational emphasis. Use coral only for destructive, error, or urgent states.
5. Build desktop layouts on a 12-column grid with asymmetric bento spans. Collapse to one column on mobile.
6. Use borders and tonal separation before shadows. Apply only one strong elevation level per viewport.
7. Use Space Grotesk for headings, Inter for product UI, Readex Pro for editorial copy, and JetBrains Mono for code and technical metadata.
8. Use 44px minimum interactive targets and `:focus-visible` with the theme focus token.
9. Keep animations between 140–320ms, respect `prefers-reduced-motion`, and never use looping decorative motion.
10. Keep copy direct and in sentence case. Prefer one primary action per section.

## Before returning UI code

Check that:

- All component colors map to semantic tokens.
- Light and dark themes both remain legible.
- The mobile layout works without horizontal scrolling.
- Status is not communicated by color alone.
- No section uses more than one ambient gradient.
- Cards are not used as generic wrappers for every block.
- Primary actions remain visually dominant without flooding the page with green.

The visual target is: confident, intelligent, optimistic, precise, quietly bold.
