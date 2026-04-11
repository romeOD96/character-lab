from __future__ import annotations

import os
from typing import Any, Dict, List

import google.generativeai as genai

from characterengine.character_schemes import GenerationRequest
from characterengine.prompt_builder import build_prompt
from characterengine.consistency_checks import basic_consistency_report

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")


class CharacterGenerator:
    """
    Core generation engine.

    Coordinates the full pipeline:
      1) Validate structured inputs
      2) Build a controlled, narrative-first prompt
      3) Call the Gemini API for each output type (profile/dialogue/scene)
      4) Run consistency checks against the structured constraints
    """

    def generate(self, req: GenerationRequest) -> List[Dict[str, Any]]:
        # 1) Validate early — fail fast with readable errors
        errors = req.validate()
        if errors:
            raise ValueError("Invalid generation request:\n- " + "\n- ".join(errors))

        # 2) Build the base prompt once — same inputs = comparable results
        prompt = build_prompt(req)

        results: List[Dict[str, Any]] = []

        # 3) Generate N variations
        for idx in range(req.n_variations):
            profile = self._call_llm(prompt, "profile")
            dialogue = self._call_llm(prompt, "dialogue")
            scene = self._call_llm(prompt, "scene")

            # 4) Evaluate consistency across combined output
            combined_text = "\n".join([profile, dialogue, scene])
            report = basic_consistency_report(req, combined_text)

            results.append(
                {
                    "variation": idx + 1,
                    "prompt_preview": prompt[:200],
                    "profile": profile,
                    "dialogue": dialogue,
                    "scene": scene,
                    "consistency_report": report,
                }
            )

        return results

    def _call_llm(self, base_prompt: str, output_type: str) -> str:
        """
        Calls the Gemini API with a structured, narrative-first prompt.
        Output type is injected so each call is focused on one task.
        """
        output_instructions = {
            "profile": (
                "Produce a character profile suitable for narrative development. "
                "Include: a short bio, key personality notes, internal conflict, "
                "external goals, and a likely arc within the scenario."
            ),
            "dialogue": (
                "Produce a short dialogue sample (10-14 lines) that strongly "
                "reflects the character voice. The dialogue must clearly fit the "
                "scenario context and imply the character's motivations and fears."
            ),
            "scene": (
                "Produce a short scene (200-350 words) featuring the character "
                "acting within the scenario. Demonstrate consistent traits, "
                "motivation-driven actions, and scenario constraints."
            ),
        }[output_type]

        full_prompt = (
            "You are a narrative development assistant. Your role is to generate "
            "character content that is consistent with the structured inputs provided. "
            "Never contradict defined traits, motivations, fears, or scenario constraints. "
            "Write in clear prose. Avoid clichés and meta-commentary.\n\n"
            f"{base_prompt}\n\n"
            f"OUTPUT TASK:\n{output_instructions}"
        )

        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.8,
                max_output_tokens=600,
            ),
        )

        return response.text.strip()