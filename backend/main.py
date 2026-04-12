from __future__ import annotations

import os
import sys
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Allow backend/ to import repo-root modules (characterengine etc.)
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.storage import ScenarioStore
from characterengine.character_schemes import (
    NarrativeContext,
    CharacterProfile,
    GenerationRequest,
)
from characterengine.generator import CharacterGenerator

app = FastAPI(title="AI-Assisted Character Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "scenarios.json")
store = ScenarioStore(DATA_FILE)
generator = CharacterGenerator()


# -------------------------
# Schemas
# -------------------------

class NarrativeInput(BaseModel):
    title: str
    genre: str
    setting: str
    theme: Optional[str] = None
    high_level_plot: Optional[str] = None
    constraints: List[str] = Field(default_factory=list)


class CharacterInput(BaseModel):
    name: str
    role_in_story: str
    background: Optional[str] = None
    personality_traits: List[str] = Field(default_factory=list)
    motivations: List[str] = Field(default_factory=list)
    fears: List[str] = Field(default_factory=list)
    relationships: Dict[str, str] = Field(default_factory=dict)
    voice_notes: Optional[str] = None


class GenerateRequest(BaseModel):
    narrative: NarrativeInput
    character: CharacterInput
    output_type: str = "profile"  # profile | dialogue | scene
    n_variations: int = Field(default=1, ge=1, le=5)


class LocationCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    tags: List[str] = Field(default_factory=list)


class ScenarioCreate(BaseModel):
    title: str = Field(min_length=1)
    genre: str = Field(min_length=1)
    setting: str = Field(min_length=1)
    theme: Optional[str] = None
    high_level_plot: Optional[str] = None
    constraints: List[str] = Field(default_factory=list)


class ScenarioUpdate(BaseModel):
    title: Optional[str] = None
    genre: Optional[str] = None
    setting: Optional[str] = None
    theme: Optional[str] = None
    high_level_plot: Optional[str] = None
    constraints: Optional[List[str]] = None
    active_location_id: Optional[str] = None


# -------------------------
# Health
# -------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


# -------------------------
# Generation endpoint
# -------------------------

@app.post("/generate")
def generate(payload: GenerateRequest) -> Dict[str, Any]:
    narrative = NarrativeContext(
        title=payload.narrative.title,
        genre=payload.narrative.genre,
        setting=payload.narrative.setting,
        theme=payload.narrative.theme,
        high_level_plot=payload.narrative.high_level_plot,
        constraints=payload.narrative.constraints,
    )

    character = CharacterProfile(
        name=payload.character.name,
        role_in_story=payload.character.role_in_story,
        background=payload.character.background,
        personality_traits=payload.character.personality_traits,
        motivations=payload.character.motivations,
        fears=payload.character.fears,
        relationships=payload.character.relationships,
        voice_notes=payload.character.voice_notes,
    )

    req = GenerationRequest(
        narrative=narrative,
        character=character,
        output_type=payload.output_type,
        n_variations=payload.n_variations,
    )

    try:
        results = generator.generate(req)
        return {"results": results}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation error: {str(e)}")


# -------------------------
# Scenario endpoints
# -------------------------

@app.get("/scenarios")
def list_scenarios() -> Dict[str, Any]:
    scenarios = store.list_scenarios()
    return {"scenarios": [s.__dict__ for s in scenarios]}


@app.post("/scenarios")
def create_scenario(payload: ScenarioCreate) -> Dict[str, Any]:
    s = store.create_scenario(
        title=payload.title,
        genre=payload.genre,
        setting=payload.setting,
        theme=payload.theme,
        high_level_plot=payload.high_level_plot,
        constraints=payload.constraints,
    )
    return {"scenario": s.__dict__}


@app.get("/scenarios/{scenario_id}")
def get_scenario(scenario_id: str) -> Dict[str, Any]:
    s = store.get_scenario(scenario_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {"scenario": s.__dict__}


@app.patch("/scenarios/{scenario_id}")
def update_scenario(scenario_id: str, payload: ScenarioUpdate) -> Dict[str, Any]:
    try:
        s = store.update_scenario(
            scenario_id=scenario_id,
            title=payload.title,
            genre=payload.genre,
            setting=payload.setting,
            theme=payload.theme,
            high_level_plot=payload.high_level_plot,
            constraints=payload.constraints,
            active_location_id=payload.active_location_id,
        )
        return {"scenario": s.__dict__}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/scenarios/{scenario_id}/locations")
def add_location(scenario_id: str, payload: LocationCreate) -> Dict[str, Any]:
    try:
        loc = store.add_location(
            scenario_id=scenario_id,
            name=payload.name,
            description=payload.description,
            tags=payload.tags,
        )
        return {"location": loc.__dict__}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/scenarios/{scenario_id}/locations/{location_id}/activate")
def activate_location(scenario_id: str, location_id: str) -> Dict[str, Any]:
    try:
        s = store.set_active_location(scenario_id, location_id)
        return {"scenario": s.__dict__}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))