from __future__ import annotations

import os
import sys
from typing import List, Dict, Any, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Allow backend/ to import your engine modules (repo root)
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from characterengine.character_schemes import NarrativeContext, CharacterProfile, GenerationRequest
from characterengine.generator import CharacterGenerator


app = FastAPI(title="AI-Assisted Character Generator API")

# Allow React dev server to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NarrativePayload(BaseModel):
    title: str
    genre: str
    setting: str
    theme: Optional[str] = None
    high_level_plot: Optional[str] = None
    constraints: List[str] = Field(default_factory=list)


class CharacterPayload(BaseModel):
    name: str
    role_in_story: str
    background: Optional[str] = None
    personality_traits: List[str] = Field(default_factory=list)
    motivations: List[str] = Field(default_factory=list)
    fears: List[str] = Field(default_factory=list)
    relationships: Dict[str, str] = Field(default_factory=dict)
    voice_notes: Optional[str] = None


class GenerateRequest(BaseModel):
    narrative: NarrativePayload
    character: CharacterPayload
    n_variations: int = 1


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate")
def generate(payload: GenerateRequest) -> Dict[str, Any]:
    narrative = NarrativeContext(**payload.narrative.model_dump())
    character = CharacterProfile(**payload.character.model_dump())

    # We generate all three outputs in your engine (profile/dialogue/scene)
    req = GenerationRequest(
        narrative=narrative,
        character=character,
        output_type="profile",     # not used if your generator returns all 3; safe to keep
        n_variations=payload.n_variations,
    )

    gen = CharacterGenerator()
    results = gen.generate(req)
    return {"results": results}
