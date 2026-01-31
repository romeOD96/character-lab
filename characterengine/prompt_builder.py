from __future__ import annotations

from typing import List
from characterengine.character_schemes import GenerationRequest


def _bullets(items: List[str]) -> str:
    """
    Helper function to format lists as bullet points for the prompt.
    This keeps prompt structure consistent and readable.
    """
    if not items:
        return "- (none)"
    return "\n".join([f"- {x}" for x in items])


def build_prompt(req: GenerationRequest) -> str:
    """
    Constructs a controlled, narrative-first prompt for character generation.

    The prompt is designed to:
    - prioritise narrative context over isolated character generation
    - enforce structure through explicit sections
    - support repeatable and comparable outputs for evaluation
    """
    # Extract narrative and character objects for readability
    n = req.narrative
    c = req.character

    # Format scenario constraints as bullet points
    constraints_block = _bullets(n.constraints)

    # Format relationships if any exist; otherwise show a placeholder
    relationships_block = "- (none)"
    if c.relationships:
        relationships_block = "\n".join(
            [f"- {k}: {v}" for k, v in c.relationships.items()]
        )

    # Select output instructions based on requested generation type
    # This avoids free-form prompting and keeps generation tasks explicit
    output_instructions = {
        "profile": (
            "Produce a character profile suitable for narrative development.\n"
            "Include: a short bio, key personality notes, internal conflict, "
            "external goals, and a likely arc within the scenario."
        ),
        "dialogue": (
            "Produce a short dialogue sample (10–14 lines) that strongly "
            "reflects the character voice.\n"
            "The dialogue must clearly fit the scenario context and should "
            "imply the character’s motivations and fears."
        ),
        "scene": (
            "Produce a short scene prompt (200–350 words) featuring the "
            "character acting within the scenario.\n"
            "The scene must demonstrate consistent traits, motivation-driven "
            "actions, and scenario constraints."
        ),
    }[req.output_type]

    # Assemble the final prompt using clearly separated sections
    # This structure helps reduce inconsistency in generated outputs
    return f"""
You are assisting with narrative development. Generate outputs that are consistent with BOTH:
(1) the narrative scenario and constraints and
(2) the structured character definition.

NARRATIVE SCENARIO
Title: {n.title}
Genre: {n.genre}
Setting: {n.setting}
Theme: {n.theme or "N/A"}
High-level plot: {n.high_level_plot or "N/A"}

Scenario constraints:
{constraints_block}

CHARACTER DEFINITION (structured)
Name: {c.name}
Role in story: {c.role_in_story}
Background: {c.background or "N/A"}

Personality traits:
{_bullets(c.personality_traits)}

Motivations:
{_bullets(c.motivations)}

Fears:
{_bullets(c.fears)}

Relationships:
{relationships_block}

Voice notes:
{c.voice_notes or "N/A"}

OUTPUT TASK
{output_instructions}

FORMAT REQUIREMENTS
- Write in clear prose.
- Avoid generic clichés.
- Do not contradict the character traits or the scenario constraints.
- Keep the output self-contained (no meta commentary).
""".strip()
