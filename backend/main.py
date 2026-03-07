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

from backend.storage import ScenarioStore  # NEW

app = FastAPI(title="AI-Assisted Character Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JSON storage file lives inside backend/data/
DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "scenarios.json")
store = ScenarioStore(DATA_FILE)


# -------------------------
# Schemas
# -------------------------

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
# Scenario endpoints (separate from generation)
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
        # could be scenario not found OR location not found
        raise HTTPException(status_code=404, detail=str(e))