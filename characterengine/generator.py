from __future__ import annotations

from typing import List, Dict
from characterengine.character_schemes import GenerationRequest
from characterengine.prompt_builder import build_prompt
from characterengine.consistency_checks import basic_consistency_report


class CharacterGenerator:
    """
    Coordinates prompt construction, generation, and consistency evaluation.
    Acts as the core character generation engine.
    """

    def generate(self, req: GenerationRequest) -> List[Dict[str, object]]:
        errors = req.validate()
        if errors:
            raise ValueError("Invalid generation request:\n- " + "\n- ".join(errors))

        prompt = build_prompt(req)
        results: List[Dict[str, object]] = []

        for i in range(req.n_variations):
            # Stubbed output for now (replace with LLM API later)
            output_text = self._stub_output(req)

            report = basic_consistency_report(req, output_text)

            results.append(
                {
                    "variation": i + 1,
                    "prompt": prompt,
                    "output": output_text,
                    "consistency_report": report,
                }
            )

        return results

    def _stub_output(self, req: GenerationRequest) -> str:
        """
        Temporary placeholder output so the pipeline can be tested
        without external API integration.
        """
        c = req.character
        n = req.narrative

        return (
            f"{c.name} is a {c.role_in_story} in {n.setting}. "
            f"They are driven by {', '.join(c.motivations)} but fear "
            f"{', '.join(c.fears) or 'the consequences of their actions'}. "
            f"The narrative constraints ({', '.join(n.constraints)}) "
            f"shape their decisions throughout the story."
        )
