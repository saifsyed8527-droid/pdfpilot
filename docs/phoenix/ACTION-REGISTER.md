# Project Phoenix — Action Register

Tracks execution-mode work only (post-Blueprint). Pre-Phoenix tool catalog and content (the ~90-tool, fully-audited "Version 1" baseline) is out of scope for this register — it was already shipped and assessed across the audit phases, not re-tracked here.

| ID | Item | Type | Sprint | Status |
|---|---|---|---|---|
| PHX-001 | `PageThumbnailGrid` reusable component (canvas-based page rendering, accessible click-to-select grid) | Component | Pre-Sprint (built alongside PHX-002) | COMPLETE |
| PHX-002 | Split PDF visual redesign (thumbnail selection, live range computation, output-preview reuse) | Tool Implementation | Pre-Sprint (Blueprint reference implementation / quality bar) | COMPLETE |
| PHX-003 | Trust Signal Elevation — shared `FileUpload` trust badge | Cross-cutting UX/Trust | PHX-SPRINT-001 | COMPLETE |
| PHX-004 | Rotate PDF visual redesign (per-page thumbnail rotation) + `PageThumbnailGrid` extension (`pageRotations`, `renderPageAction`, optional selection mode) | Tool Implementation + Component Extension | PHX-SPRINT-002 | COMPLETE |
| PHX-005 | Delete Pages — PageThumbnailGrid reuse (pure selection, no new architecture) | Tool Implementation | PHX-SPRINT-003 | COMPLETE |
| PHX-006 | Extract Pages — PageThumbnailGrid reuse (pure selection, no new architecture) | Tool Implementation | PHX-SPRINT-004 | COMPLETE |
| PHX-007 | Duplicate Pages — PageThumbnailGrid reuse (pure selection, no new architecture) | Tool Implementation | Unscheduled | PLANNED |
| PHX-008 | Insert Pages — thumbnail-based insertion-point selection (depends on per-thumbnail action pattern from PHX-004) | Tool Implementation | Unscheduled | PLANNED |

**Correction on record:** an earlier audit pass (Product/UX Audit, Wave 1) stated that only Split PDF had a visual workspace and that Merge PDF and Rearrange Pages still needed one. Direct code verification during this sprint's dependency analysis found this to be inaccurate — both **Merge PDF** and **Rearrange Pages** already have real, working `@dnd-kit`-based drag-and-drop thumbnail workspaces, predating this audit. That finding is recorded here rather than silently corrected, since it changed the Sprint 2 tool selection.
