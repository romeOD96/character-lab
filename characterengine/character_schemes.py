from dataclasses import dataclass


@dataclass
class NarrativeContext:
    """
    Represents the narrative or scenario in which characters are generated.
    """
    def __init__(self, title, genre, setting, theme=None, high_level_plot=None, constraints=None):
        self.title = title
        self.genre = genre
        self.setting = setting
        self.theme = theme
        self.high_level_plot = high_level_plot
        self.constraints = constraints if constraints is not None else []

    def validate(self):
        errors = []
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
    """
    def __init__(self, name, role_in_story, background=None,
                 personality_traits=None, motivations=None,
                 fears=None, relationships=None, voice_notes=None):

        self.name = name
        self.role_in_story = role_in_story
        self.background = background
        self.personality_traits = personality_traits if personality_traits is not None else []
        self.motivations = motivations if motivations is not None else []
        self.fears = fears if fears is not None else []
        self.relationships = relationships if relationships is not None else {}
        self.voice_notes = voice_notes

    def validate(self):
        errors = []
        if not self.name.strip():
            errors.append("CharacterProfile.name is required.")
        if not self.role_in_story.strip():
            errors.append("CharacterProfile.role_in_story is required.")
        if len(self.personality_traits) == 0:
            errors.append("CharacterProfile.personality_traits should include at least one trait.")
        if len(self.motivations) == 0:
            errors.append("CharacterProfile.motivations should include at least one motivation.")
        return errors


class GenerationRequest:
    """
    Combines narrative context, character definition, and generation settings.
    """
    VALID_OUTPUT_TYPES = ["profile", "dialogue", "scene", "story_seed"]

    def __init__(self, narrative, character, output_type, n_variations=1):
        self.narrative = narrative
        self.character = character
        self.output_type = output_type
        self.n_variations = n_variations

    def validate(self):
        errors = []
        errors.extend(self.narrative.validate())
        errors.extend(self.character.validate())

        if self.output_type not in self.VALID_OUTPUT_TYPES:
            errors.append(
                f"GenerationRequest.output_type must be one of: {', '.join(self.VALID_OUTPUT_TYPES)}."
            )
        if self.n_variations < 1 or self.n_variations > 5:
            errors.append("GenerationRequest.n_variations must be between 1 and 5.")

        return errors


def to_compact_dict(req):
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