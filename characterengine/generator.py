from __future__ import annotations

import os
from typing import Any, Dict, List

from openai import OpenAI

from characterengine.character_schemes import GenerationRequest
from characterengine.prompt_builder import build_prompt
from characterengine.consistency_checks import basic_consistency_report

client = OpenAI(
    api_key=os.environ.get("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"),
    base_url="https://openrouter.ai/api/v1",
)

MODEL = "meta-llama/llama-3.3-8b-instruct:free"


class CharacterGenerator:
    """
    Core generation engine.

    Coordinates the full pipeline:
      1) Validate structured inputs
      2) Build a controlled, narrative-first prompt
      3) Call OpenRouter API for each output type (profile/dialogue/scene/story_seed)
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
            story_seed = self._call_llm(prompt, "story_seed")

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
                    "story_seed": story_seed,
                    "consistency_report": report,
                }
            )

        return results

    def _call_llm(self, base_prompt: str, output_type: str) -> str:
        """
        Calls OpenRouter with a structured, narrative-first prompt.
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
            "story_seed": (
                "Produce a short story seed (100-150 words) — an evocative opening "
                "paragraph or narrative prompt that could begin a story featuring this character. "
                "It should immediately establish voice, setting, and tension consistent with "
                "the character's traits and the scenario constraints."
            ),
        }[output_type]

        system_message = (
            "You are a narrative development assistant. Your role is to generate "
            "character content that is consistent with the structured inputs provided. "
            "Never contradict defined traits, motivations, fears, or scenario constraints. "
            "Write in clear prose. Avoid clichés and meta-commentary. "
            "Do not include headers or labels in your response — just the content itself."
        )

        user_message = f"{base_prompt}\n\nOUTPUT TASK:\n{output_instructions}"

        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            temperature=0.8,
            max_tokens=600,
        )

        return response.choices[0].message.content.strip()