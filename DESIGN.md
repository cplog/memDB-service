# Design System

## Core Aesthetic
**Restrained & Elegant (Light Mode Default)**
The interface should feel like a refined, consumer-grade reading experience or a high-end editorial tool, not a dense technical dashboard. It relies on generous whitespace, confident typography, and a stark lack of borders to create structure.

## Color Strategy: Restrained
- **Backgrounds**: Pure or near-pure white (`#FFFFFF` or `#FAFAFA`) for main canvases. Subtle off-white (`#F4F4F5`) for sidebars or secondary surfaces.
- **Text**: High contrast near-black (`#18181B` or `#09090B`) for primary text. Muted grays (`#71717A`) for secondary text.
- **Accent**: Exactly *one* purposeful accent color (e.g., a soft, vibrant green like `#10B981` or a refined blue like `#2563EB`) used exclusively for active states, primary buttons, links, and key graph nodes.
- **Borders**: Avoid whenever possible. Use whitespace (padding/margins) and subtle background shifts to separate content. If borders are absolutely necessary, they must be extremely faint (`#E4E4E7`).

## Typography
**Confident Scale & Hierarchy**
Stop whispering. The UI must use a clear, legible scale.
- **Base/Body**: 14px (or 15px) for high legibility.
- **Headers**: 18px to 24px, medium or semibold.
- **Small/Utility**: 12px (strictly reserved for metadata, timestamps, or tiny badges). Never use 10px.
- **Line Height**: Generous (1.5 to 1.6 for body text) to support reading.

## Spacing & Layout (Rhythm)
- **Whitespace is Structure**: Use `p-4`, `p-6`, or `p-8` to frame content. Elements should not feel boxed in.
- **Floating Elements**: Previews and detail panels should feel like they float cleanly over the canvas or slide in gracefully, rather than being hard-coded into rigid grid columns with heavy borders.
- **Cognitive Load**: Hide complexity. Show only what is necessary at each decision point.

## Components
- **Buttons**: Clean, standard affordances. Primary buttons use the single accent color. Secondary buttons are ghost or outline with subtle hover states.
- **Graph**: The graph should be the hero of the page. Nodes should be spaced out (stronger repulsion), with clear, readable labels.
- **Sidebars**: Minimalist. No heavy borders. Active states should use a subtle background tint or a clean left-edge indicator, not heavy colored blocks.

## Anti-Patterns (Banned)
- Dark mode "observability" aesthetics (dark backgrounds with neon accents).
- Tiny, dense text (`text-[10px]`, `text-[11px]`).
- Heavy borders separating every single UI pane.
- Identical card grids for everything.
