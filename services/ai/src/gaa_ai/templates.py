"""Display template registry (§5.1).

Templates are the guardrails: layout quality is baked into human-built templates
(implemented in the Node renderer, Phase 4). Generation may only select a
`template_id` from this registry — it never invents layout. Keep this list in
sync with the renderer's implemented templates.
"""

from __future__ import annotations

DISPLAY_TEMPLATES: tuple[str, ...] = (
    "split_image_left",  # image left, copy right
    "image_overlay_bottom",  # full-bleed image, copy band at bottom
    "bold_centered",  # solid brand-color bg, centered headline + CTA
    "minimal_left_rule",  # editorial: thin rule, left-aligned copy
)


def is_valid_template(template_id: str) -> bool:
    return template_id in DISPLAY_TEMPLATES
