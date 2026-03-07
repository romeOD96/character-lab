from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4


@dataclass
class Location:
    id: str
    name: str
    description: str = ""
    tags: List[str] = field(default_factory=list)


@dataclass
class Scenario:
    id: str
    created_at: str
    updated_at: str

    title: str
    genre: str
    setting: str
    theme: Optional[str] = None
    high_level_plot: Optional[str] = None
    constraints: List[str] = field(default_factory=list)

    # Map editor data (simple v1)
    locations: List[Location] = field(default_factory=list)
    active_location_id: Optional[str] = None


def _now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


class ScenarioStore:
    """
    Lightweight JSON-backed storage for prototype.
    Keeps scenarios persistent without introducing a DB yet.
    """

    def __init__(self, filepath: str):
        self.filepath = filepath
        self._scenarios: Dict[str, Scenario] = {}
        self._load()

    # ---------------------------
    # Public API
    # ---------------------------

    def list_scenarios(self) -> List[Scenario]:
        return sorted(self._scenarios.values(), key=lambda s: s.updated_at, reverse=True)

    def get_scenario(self, scenario_id: str) -> Optional[Scenario]:
        return self._scenarios.get(scenario_id)

    def create_scenario(
            self,
            title: str,
            genre: str,
            setting: str,
            theme: Optional[str] = None,
            high_level_plot: Optional[str] = None,
            constraints: Optional[List[str]] = None,
    ) -> Scenario:
        scenario_id = str(uuid4())
        ts = _now_iso()

        scenario = Scenario(
            id=scenario_id,
            created_at=ts,
            updated_at=ts,
            title=title,
            genre=genre,
            setting=setting,
            theme=theme,
            high_level_plot=high_level_plot,
            constraints=list(constraints or []),
            locations=[],
            active_location_id=None,
        )

        self._scenarios[scenario_id] = scenario
        self._save()
        return scenario

    def update_scenario(
            self,
            scenario_id: str,
            title: Optional[str] = None,
            genre: Optional[str] = None,
            setting: Optional[str] = None,
            theme: Optional[str] = None,
            high_level_plot: Optional[str] = None,
            constraints: Optional[List[str]] = None,
            active_location_id: Optional[str] = None,
    ) -> Scenario:
        scenario = self._require(scenario_id)

        if title is not None:
            scenario.title = title
        if genre is not None:
            scenario.genre = genre
        if setting is not None:
            scenario.setting = setting
        if theme is not None:
            scenario.theme = theme
        if high_level_plot is not None:
            scenario.high_level_plot = high_level_plot
        if constraints is not None:
            scenario.constraints = list(constraints)
        if active_location_id is not None:
            scenario.active_location_id = active_location_id

        scenario.updated_at = _now_iso()
        self._save()
        return scenario

    def add_location(
            self,
            scenario_id: str,
            name: str,
            description: str = "",
            tags: Optional[List[str]] = None,
    ) -> Location:
        scenario = self._require(scenario_id)

        loc = Location(
            id=str(uuid4()),
            name=name,
            description=description,
            tags=list(tags or []),
        )

        scenario.locations.append(loc)
        scenario.updated_at = _now_iso()
        self._save()
        return loc

    def set_active_location(self, scenario_id: str, location_id: Optional[str]) -> Scenario:
        scenario = self._require(scenario_id)

        if location_id is not None and not any(l.id == location_id for l in scenario.locations):
            raise KeyError("Location not found in scenario.")

        scenario.active_location_id = location_id
        scenario.updated_at = _now_iso()
        self._save()
        return scenario

    # ---------------------------
    # Internals
    # ---------------------------

    def _require(self, scenario_id: str) -> Scenario:
        scenario = self.get_scenario(scenario_id)
        if scenario is None:
            raise KeyError("Scenario not found.")
        return scenario

    def _load(self) -> None:
        if not os.path.exists(self.filepath):
            self._scenarios = {}
            return

        with open(self.filepath, "r", encoding="utf-8") as f:
            raw = json.load(f)

        scenarios: Dict[str, Scenario] = {}
        for s in raw.get("scenarios", []):
            locations = [Location(**l) for l in s.get("locations", [])]
            scenario = Scenario(
                id=s["id"],
                created_at=s["created_at"],
                updated_at=s["updated_at"],
                title=s["title"],
                genre=s["genre"],
                setting=s["setting"],
                theme=s.get("theme"),
                high_level_plot=s.get("high_level_plot"),
                constraints=list(s.get("constraints", [])),
                locations=locations,
                active_location_id=s.get("active_location_id"),
            )
            scenarios[scenario.id] = scenario

        self._scenarios = scenarios

    def _save(self) -> None:
        os.makedirs(os.path.dirname(self.filepath), exist_ok=True)

        payload = {
            "scenarios": [self._scenario_to_dict(s) for s in self._scenarios.values()]
        }
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

    def _scenario_to_dict(self, s: Scenario) -> dict:
        d = asdict(s)
        # dataclasses will already convert nested dataclasses to dict via asdict
        return d