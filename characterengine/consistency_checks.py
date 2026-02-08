from __future__ import annotations

import re
from typing import Dict, List
from characterengine.character_schemes import GenerationRequest


def _keyword_hits(text: str, keywords: List[str]) -> int:
    """
    Counts how many of the provided keywords appear in the generated text.
    This is a lightweight heuristic for early-stage consistency checking.
    """
    text_lower = text.lower()
    hits = 0

    for kw in keywords:
        kw = kw.lower().strip()
        if kw and kw in text_lower:
            hits += 1

    return hits


def basic_consistency_report(
        req: GenerationRequest, generated_text: str
) -> Dict[str, object]:
    """
    Produces a simple consistency report indicating whether the generated
    output aligns with the structured character and narrative inputs.
    """
    c = req.character
    n = req.narrative

    trait_hits = _keyword_hits(generated_text, c.personality_traits)
    motivation_hits = _keyword_hits(generated_text, c.motivations)
    fear_hits = _keyword_hits(generated_text, c.fears)
    constraint_hits = _keyword_hits(generated_text, n.constraints)

    notes: List[str] = []

    if trait_hits == 0:
        notes.append("Personality traits not clearly reflected.")
    if motivation_hits == 0:
        notes.append("Character motivations not clearly reflected.")
    if c.fears and fear_hits == 0:
        notes.append("Character fears not clearly reflected.")
    if n.constraints and constraint_hits == 0:
        notes.append("Narrative constraints not referenced.")

    # Detect common meta leakage from LLMs
    if re.search(r"\b(as an ai|i cannot|i can't)\b", generated_text.lower()):
        notes.append("Meta or assistant-style language detected.")

    score = (
            min(trait_hits, 2)
            + min(motivation_hits, 2)
            + min(fear_hits, 1)
            + min(constraint_hits, 2)
    )

    return {
        "score_out_of_7": score,
        "trait_hits": trait_hits,
        "motivation_hits": motivation_hits,
        "fear_hits": fear_hits,
        "constraint_hits": constraint_hits,
        "notes": notes,
    }
