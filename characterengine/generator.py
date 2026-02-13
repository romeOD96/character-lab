from __future__ import annotations

from typing import Any, Dict, List

from characterengine.character_schemes import GenerationRequest
from characterengine.prompt_builder import build_prompt
from characterengine.consistency_checks import basic_consistency_report


class CharacterGenerator:
    """
    Core generation engine.

    This class coordinates the full pipeline:
      1) validate structured inputs
      2) build a controlled, narrative-first prompt
      3) generate modular outputs (profile/dialogue/scene) — currently stubbed
      4) run consistency checks against the structured constraints
    """

    def generate(self, req: GenerationRequest) -> List[Dict[str, Any]]:
        # 1) Validate request early so we fail fast with readable errors
        errors = req.validate()
        if errors:
            raise ValueError("Invalid generation request:\n- " + "\n- ".join(errors))

        # 2) Build the full prompt once per request (same inputs → comparable results)
        prompt = build_prompt(req)

        results: List[Dict[str, Any]] = []

        # 3) Generate N variations (useful for comparing outputs + prompt tuning)
        for idx in range(req.n_variations):
            profile = self._generate_profile(req)
            dialogue = self._generate_dialogue(req)
            scene = self._generate_scene(req)

            # 4) Evaluate consistency across the combined output
            combined_text = "\n".join([profile, dialogue, scene])
            report = basic_consistency_report(req, combined_text)

            results.append(
                {
                    "variation": idx + 1,
                    "prompt_preview": prompt[:200],  # keep responses concise for UI/logging
                    "profile": profile,
                    "dialogue": dialogue,
                    "scene": scene,
                    "consistency_report": report,
                }
            )

        return results

    # ---------------------------------------------------------------------
    # Stub outputs (replace with external LLM API integration later)
    # ---------------------------------------------------------------------

    def _generate_profile(self, req: GenerationRequest) -> str:
        """Generate a compact character profile grounded in the narrative context."""
        c = req.character
        n = req.narrative

        traits = ", ".join(c.personality_traits) if c.personality_traits else "complex"
        motivations = ", ".join(c.motivations) if c.motivations else "unclear motives"
        fears = ", ".join(c.fears) if c.fears else "an inner conflict"

        return (
            f"{c.name} is a {c.role_in_story} within '{n.title}'. "
            f"They are known for being {traits}. "
            f"Their motivations include {motivations}, "
            f"while they struggle with {fears}."
        )

    def _generate_dialogue(self, req: GenerationRequest) -> str:
        """Generate a short dialogue line that reflects motivation + fear."""
        c = req.character
        n = req.narrative

        primary_motivation = c.motivations[0] if c.motivations else "to survive"
        primary_fear = c.fears[0] if c.fears else "the unknown"

        return (
            f'{c.name}: "In {n.setting}, nothing comes free. '
            f'I want {primary_motivation}, but I fear {primary_fear}."'
        )

    def _generate_scene(self, req: GenerationRequest) -> str:
        """Generate a lightweight scene prompt anchored to constraints."""
        c = req.character
        n = req.narrative

        primary_trait = c.personality_traits[0] if c.personality_traits else "careful"
        constraint_text = ", ".join(n.constraints) if n.constraints else "every action has consequences"

        return (
            f"In {n.setting}, {c.name} pauses. Being {primary_trait}, "
            f"they weigh the rule that '{constraint_text}'."
        )
