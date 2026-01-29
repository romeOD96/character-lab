from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class NarrativeContext:
    """
    Represents the narrative or scenario in which characters are generated.
    This ensures characters are created within a story context rather than in isolation.
    """
    title: str                 # Short name for the narrative or scenario
    genre: str                 # Genre used to guide tone and style of generation
    setting: str               # Where the story takes place
    theme: Optional[str] = None
    high_level_plot: Optional[str] = None
    constraints: List[str] = field(default_factory=list)  # Rules the AI must respect

    def validate(self) -> List[str]:
        """
        Performs basic validation to ensure required narrative fields are present.
        Returns a list of error messages rather than raising exceptions,
        allowing multiple issues to be reported at once.
        """
        errors: List[str] = []

        if not self.title.strip():
            errors.append("NarrativeContext.title is required.")
        if not self.genre.strip():
            errors.append("NarrativeContext.genre is required.")
        if not self.setting.strip():
            errors.append("NarrativeContext.setting is required.")

        return errors


@dataclass
class CharacterProfile:
    """
    Structured definition of a character.
    This data is used to guide AI generation and later evaluate consistency.
    """
    name: str                          # Character name
    role_in_story: str                # Narrative role (e.g. protagonist, antagonist)
    background: Optional[str] = None  # Optional backstory or history

    # Explicit traits allow for controllable generation and evaluation
    personality_traits: List[str] = field(default_factory=list)
    motivations: List[str] = field(default_factory=list)
    fears: List[str] = field(default_factory=list)

    # Maps other character names to relationship descriptions
    relationships: Dict[str, str] = field(default_factory=dict)
    voice_notes: Optional[str] = None  # Notes on tone or speech style

    def validate(self) -> List[str]:
        """
        Validates that the character definition contains enough structure
        to support meaningful and consistent generation.
        """
        errors: List[str] = []

        if not self.name.strip():
            errors.append("CharacterProfile.name is required.")
        if not self.role_in_story.strip():
            errors.append("CharacterProfile.role_in_story is required.")

        # Require at least minimal structure, but remain flexible for creativity
        if len(self.personality_traits) == 0:
            errors.append("CharacterProfile.personality_traits should include at least one trait.")
        if len(self.motivations) == 0:
            errors.append("CharacterProfile.motivations should include at least one motivation.")

        return errors


@dataclass
class GenerationRequest:
    """
    Combines narrative context, character definition, and generation settings
    into a single request passed through the generation pipeline.
    """
    narrative: NarrativeContext
    character: CharacterProfile
    output_type: str          # Determines what is generated: profile, dialogue, or scene
    n_variations: int = 1     # Number of alternative generations to produce

    def validate(self) -> List[str]:
        """
        Validates the full generation request, including nested components.
        This ensures errors are caught early before prompt construction or generation.
        """
        errors = []

        errors.extend(self.narrative.validate())
        errors.extend(self.character.validate())

        if self.output_type not in {"profile", "dialogue", "scene"}:
            errors.append(
                "GenerationRequest.output_type must be one of: profile, dialogue, scene."
            )

        # Limit variations to keep generation manageable and comparable
        if self.n_variations < 1 or self.n_variations > 5:
            errors.append(
                "GenerationRequest.n_variations must be between 1 and 5."
            )

        return errors


def to_compact_dict(req: GenerationRequest) -> Dict[str, Any]:
    """
    Converts a GenerationRequest into a plain dictionary.
    Useful for debugging, logging, exporting, or serialisation (e.g. JSON).
    """
    return {
        "narrative": {
            "title": req.narrative.title,
            "genre": req.narrative.genre,
            "setting": req.narrative.setting,
            "theme": req.narrative.theme,
            "high_level_plot": req.narrative.high_level_plot,
            "constraints": list(req.narrative.constraints),
        },
        "character": {
            "name": req.character.name,
            "role_in_story": req.character.role_in_story,
            "background": req.character.background,
            "personality_traits": list(req.character.personality_traits),
            "motivations": list(req.character.motivations),
            "fears": list(req.character.fears),
            "relationships": dict(req.character.relationships),
            "voice_notes": req.character.voice_notes,
        },
        "output_type": req.output_type,
        "n_variations": req.n_variations,
    }
