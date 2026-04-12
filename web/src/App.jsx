import { useMemo, useState, useRef } from "react";
import "./app.css";

const API_BASE = "http://127.0.0.1:8000";

function linesToArray(s) {
    return s.split("\n").map((x) => x.trim()).filter(Boolean);
}

function Field({ label, tooltip, children, style }) {
    return (
        <label className="fieldWrap" style={style}>
      <span className="fieldLabel">
        {label}
          {tooltip && <span className="tooltip">{tooltip}</span>}
      </span>
            {children}
        </label>
    );
}

function ConsistencyCard({ report }) {
    if (!report) return null;
    const score = report.score_out_of_7 ?? 0;
    const pct = Math.round((score / 7) * 100);
    const color = pct >= 70 ? "#2dd4bf" : pct >= 40 ? "#f59e0b" : "#f87171";

    const rows = [
        { label: "Personality traits reflected", hits: report.trait_hits },
        { label: "Motivations reflected", hits: report.motivation_hits },
        { label: "Fears reflected", hits: report.fear_hits },
        { label: "Constraints referenced", hits: report.constraint_hits },
    ];

    return (
        <div className="consistencyCard">
            <div className="consistencyScore">
                <div className="scoreBig" style={{ color }}>{score}<span className="scoreMax">/7</span></div>
                <div className="scoreBar">
                    <div className="scoreBarFill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <div className="scoreLabel" style={{ color }}>
                    {pct >= 70 ? "Strong consistency" : pct >= 40 ? "Partial consistency" : "Low consistency"}
                </div>
            </div>

            <div className="consistencyRows">
                {rows.map((r) => (
                    <div key={r.label} className="consistencyRow">
                        <span className="cRowLabel">{r.label}</span>
                        <span className="cRowHits" style={{ color: r.hits > 0 ? "#2dd4bf" : "#f87171" }}>
              {r.hits > 0 ? `✓ ${r.hits} hit${r.hits > 1 ? "s" : ""}` : "✗ not found"}
            </span>
                    </div>
                ))}
            </div>

            {report.notes && report.notes.length > 0 && (
                <div className="consistencyNotes">
                    {report.notes.map((n, i) => (
                        <div key={i} className="consistencyNote">⚠ {n}</div>
                    ))}
                </div>
            )}
        </div>
    );
}

function getNodePosition(index, total) {
    if (total === 1) return { x: 50, y: 50 };
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const rx = 36, ry = 32;
    return {
        x: 50 + rx * Math.cos(angle),
        y: 50 + ry * Math.sin(angle),
    };
}

export default function App() {
    const [characters, setCharacters] = useState([
        { id: "c1", name: "Iris Vale", role: "Protagonist", locationId: null },
        { id: "c2", name: "Lucan Mercer", role: "Antagonist", locationId: null },
        { id: "c3", name: "Mara Quinn", role: "Mentor", locationId: null },
    ]);
    const [selectedChar, setSelectedChar] = useState(null);

    const [locations, setLocations] = useState([]);
    const [activeLocationId, setActiveLocationId] = useState(null);
    const [newLocName, setNewLocName] = useState("");
    const [newLocDesc, setNewLocDesc] = useState("");
    const [showAddLoc, setShowAddLoc] = useState(false);
    const [positions, setPositions] = useState({});
    const [dragging, setDragging] = useState(null);
    const mapRef = useRef(null);

    const [title, setTitle] = useState("");
    const [genre, setGenre] = useState("");
    const [setting, setSetting] = useState("");
    const [theme, setTheme] = useState("");
    const [constraintsText, setConstraintsText] = useState("");

    const [charName, setCharName] = useState("");
    const [roleInStory, setRoleInStory] = useState("");
    const [background, setBackground] = useState("");
    const [traitsText, setTraitsText] = useState("");
    const [motivationsText, setMotivationsText] = useState("");
    const [fearsText, setFearsText] = useState("");
    const [relationshipsText, setRelationshipsText] = useState("");
    const [nVariations, setNVariations] = useState(1);

    const [activeTab, setActiveTab] = useState("profile");
    const [latest, setLatest] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [statusMsg, setStatusMsg] = useState("");

    const constraints = useMemo(() => linesToArray(constraintsText), [constraintsText]);
    const personality_traits = useMemo(() => linesToArray(traitsText), [traitsText]);
    const motivations = useMemo(() => linesToArray(motivationsText), [motivationsText]);
    const fears = useMemo(() => linesToArray(fearsText), [fearsText]);

    // Parse relationships from "Name: role" format
    const relationships = useMemo(() => {
        const obj = {};
        linesToArray(relationshipsText).forEach((line) => {
            const [name, ...rest] = line.split(":");
            if (name && rest.length) obj[name.trim()] = rest.join(":").trim();
        });
        return obj;
    }, [relationshipsText]);

    const activeLocation = locations.find((l) => l.id === activeLocationId) || null;

    function selectChar(c) {
        setSelectedChar(c.id);
        setCharName(c.name);
        setRoleInStory(c.role);
    }

    function addLocation() {
        if (!newLocName.trim()) return;
        const id = crypto.randomUUID();
        const newLoc = { id, name: newLocName.trim(), description: newLocDesc.trim(), tags: [] };
        const updated = [...locations, newLoc];
        setLocations(updated);
        const pos = getNodePosition(updated.length - 1, updated.length);
        setPositions((prev) => ({ ...prev, [id]: pos }));
        setNewLocName("");
        setNewLocDesc("");
        setShowAddLoc(false);
    }

    function removeLocation(id) {
        setLocations((prev) => prev.filter((l) => l.id !== id));
        if (activeLocationId === id) setActiveLocationId(null);
        setPositions((prev) => { const n = { ...prev }; delete n[id]; return n; });
        setCharacters((prev) => prev.map((c) => c.locationId === id ? { ...c, locationId: null } : c));
    }

    function assignCharToLocation(charId, locId) {
        setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, locationId: locId || null } : c));
    }

    function onMouseDown(e, locId) {
        e.preventDefault();
        setDragging(locId);
    }

    function onMouseMove(e) {
        if (!dragging || !mapRef.current) return;
        const rect = mapRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setPositions((prev) => ({ ...prev, [dragging]: { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) } }));
    }

    function onMouseUp() { setDragging(null); }

    // Export character + latest output as JSON download
    function exportJSON() {
        if (!latest) return;
        const data = {
            scenario: { title, genre, setting, theme, constraints },
            character: { name: charName, role: roleInStory, background, personality_traits, motivations, fears, relationships },
            activeLocation: activeLocation ? { name: activeLocation.name, description: activeLocation.description } : null,
            generation: {
                profile: latest.profile,
                dialogue: latest.dialogue,
                scene: latest.scene,
                story_seed: latest.story_seed || null,
                consistency_report: latest.consistency_report,
            },
            exported_at: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${charName || "character"}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async function generate() {
        setGenerating(true);
        setStatusMsg("Generating…");
        setLatest(null);

        const locationContext = activeLocation
            ? `\nActive Location: ${activeLocation.name}${activeLocation.description ? ` — ${activeLocation.description}` : ""}`
            : "";

        const charsAtLocation = characters.filter((c) => c.locationId === activeLocationId && c.id !== selectedChar);
        const charContext = charsAtLocation.length > 0
            ? `\nOther characters present: ${charsAtLocation.map((c) => `${c.name} (${c.role})`).join(", ")}`
            : "";

        try {
            const res = await fetch(`${API_BASE}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    n_variations: Number(nVariations),
                    narrative: {
                        title,
                        genre,
                        setting: setting + locationContext + charContext,
                        theme,
                        high_level_plot: null,
                        constraints,
                    },
                    character: {
                        name: charName,
                        role_in_story: roleInStory,
                        background,
                        personality_traits,
                        motivations,
                        fears,
                        relationships,
                        voice_notes: "",
                    },
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setStatusMsg(`Error: ${data?.detail || "Generation failed"}`);
                return;
            }

            const first = (data.results || [])[0];
            setLatest(first || null);
            setStatusMsg(first ? "Generation complete." : "No results returned.");
            setActiveTab("profile");
        } catch (e) {
            setStatusMsg(`Error: ${String(e)}`);
        } finally {
            setGenerating(false);
        }
    }

    const TABS = ["profile", "dialogue", "scene", "story seed", "consistency"];

    return (
        <div className="app">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="brand">
                    <div className="logo" />
                    <div>
                        <div className="brandTitle">Character Lab</div>
                        <div className="brandSub">narrative-first generator</div>
                    </div>
                </div>

                <div className="sectionTitle">Characters</div>
                <div className="list">
                    {characters.map((c) => {
                        const loc = locations.find((l) => l.id === c.locationId);
                        return (
                            <button
                                key={c.id}
                                className={`item ${selectedChar === c.id ? "active" : ""}`}
                                onClick={() => selectChar(c)}
                                type="button"
                            >
                                <div className="itemName">{c.name}</div>
                                <div className="itemMeta">{c.role}</div>
                                {loc && <div className="itemLoc">📍 {loc.name}</div>}
                            </button>
                        );
                    })}
                </div>

                {selectedChar && locations.length > 0 && (
                    <div className="assignBox">
                        <div className="sectionTitle" style={{ marginTop: 0 }}>Assign to location</div>
                        <select
                            className="selectInput"
                            value={characters.find((c) => c.id === selectedChar)?.locationId || ""}
                            onChange={(e) => assignCharToLocation(selectedChar, e.target.value)}
                        >
                            <option value="">— None —</option>
                            {locations.map((l) => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="hint">
                    Click a character to load them into the form. Assign them to a map location to ground generation in place.
                </div>
            </aside>

            {/* Centre */}
            <main className="main">
                <div className="mapPanel">
                    <div className="mapHeader">
                        <span className="mapTitle">🗺 Narrative Map — {title || "Untitled Scenario"}</span>
                        <button className="btn ghost small" type="button" onClick={() => setShowAddLoc((v) => !v)}>
                            + Add Location
                        </button>
                    </div>

                    {showAddLoc && (
                        <div className="addLocForm">
                            <input className="input small" placeholder="Location name…" value={newLocName} onChange={(e) => setNewLocName(e.target.value)} />
                            <input className="input small" placeholder="Short description (optional)…" value={newLocDesc} onChange={(e) => setNewLocDesc(e.target.value)} />
                            <button className="btn small" type="button" onClick={addLocation}>Add</button>
                            <button className="btn ghost small" type="button" onClick={() => setShowAddLoc(false)}>Cancel</button>
                        </div>
                    )}

                    <div className="mapCanvas" ref={mapRef} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
                        {locations.length === 0 && (
                            <div className="mapEmpty">Add locations to build your narrative world map.</div>
                        )}
                        <svg className="mapSvg">
                            {locations.map((loc, i) =>
                                locations.slice(i + 1).map((loc2, j) => {
                                    const p1 = positions[loc.id] || getNodePosition(i, locations.length);
                                    const p2 = positions[loc2.id] || getNodePosition(i + j + 1, locations.length);
                                    return (
                                        <line key={`${loc.id}-${loc2.id}`}
                                              x1={`${p1.x}%`} y1={`${p1.y}%`}
                                              x2={`${p2.x}%`} y2={`${p2.y}%`}
                                              stroke="rgba(124,92,255,0.15)" strokeWidth="1" strokeDasharray="4 4"
                                        />
                                    );
                                })
                            )}
                        </svg>

                        {locations.map((loc, i) => {
                            const pos = positions[loc.id] || getNodePosition(i, locations.length);
                            const isActive = loc.id === activeLocationId;
                            const charsHere = characters.filter((c) => c.locationId === loc.id);
                            return (
                                <div
                                    key={loc.id}
                                    className={`mapNode ${isActive ? "active" : ""}`}
                                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                                    onMouseDown={(e) => onMouseDown(e, loc.id)}
                                    onClick={() => setActiveLocationId(isActive ? null : loc.id)}
                                >
                                    <div className="nodeDot" />
                                    <div className="nodeLabel">{loc.name}</div>
                                    {charsHere.length > 0 && (
                                        <div className="nodeChars">
                                            {charsHere.map((c) => <span key={c.id} className="charTag">{c.name.split(" ")[0]}</span>)}
                                        </div>
                                    )}
                                    <button className="nodeRemove" type="button" onClick={(e) => { e.stopPropagation(); removeLocation(loc.id); }}>×</button>
                                </div>
                            );
                        })}
                    </div>

                    {activeLocation && (
                        <div className="activeLocBar">
                            <span>📍 Active: <strong>{activeLocation.name}</strong></span>
                            {activeLocation.description && <span className="muted"> — {activeLocation.description}</span>}
                            <span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>Injected into generation</span>
                        </div>
                    )}
                </div>

                {/* Output */}
                <div className="outputPanel">
                    <div className="outputHeader">
                        <div className="tabs">
                            {TABS.map((t) => (
                                <button key={t} type="button" className={`tab ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>
                                    {t}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            {latest && (
                                <button className="btn ghost small" type="button" onClick={exportJSON}>
                                    ↓ Export JSON
                                </button>
                            )}
                            <button className="btn" type="button" onClick={generate} disabled={generating}>
                                {generating ? "Generating…" : "Generate"}
                            </button>
                        </div>
                    </div>

                    {statusMsg && <div className="statusMsg">{statusMsg}</div>}

                    <div className="output">
                        {!latest && <div className="muted">Fill in the scenario and character on the right, then click Generate.</div>}
                        {latest && activeTab === "profile" && <div className="outText">{latest.profile}</div>}
                        {latest && activeTab === "dialogue" && <div className="outText">{latest.dialogue}</div>}
                        {latest && activeTab === "scene" && <div className="outText">{latest.scene}</div>}
                        {latest && activeTab === "story seed" && <div className="outText">{latest.story_seed || "No story seed generated."}</div>}
                        {latest && activeTab === "consistency" && <ConsistencyCard report={latest.consistency_report} />}
                    </div>
                </div>
            </main>

            {/* Right panel */}
            <aside className="panel">
                <div className="panelTitle">Scenario</div>
                <div className="form">
                    <div className="grid2">
                        <Field label="Title" tooltip="The main title of your story or narrative world.">
                            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The City That Forgets" />
                        </Field>
                        <Field label="Genre" tooltip="The genre shapes tone and style — e.g. Fantasy, Sci-Fi, Thriller.">
                            <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="e.g. Urban Fantasy" />
                        </Field>
                    </div>

                    <Field label="Setting" tooltip="Where and when the story takes place. Be specific.">
                        <input value={setting} onChange={(e) => setSetting(e.target.value)} placeholder="e.g. A city where memories can be bought and sold" />
                    </Field>

                    <Field label="Theme (optional)" tooltip="The central idea your story explores.">
                        <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Identity and sacrifice" />
                    </Field>

                    <Field label="Constraints (one per line)" tooltip="World rules the AI must not break. One per line.">
                        <textarea rows={2} value={constraintsText} onChange={(e) => setConstraintsText(e.target.value)} placeholder={"Magic has a cost\nMemories cannot be fully restored"} />
                    </Field>

                    <div className="divider" />
                    <div className="panelTitle" style={{ marginTop: 0 }}>Character</div>

                    <div className="grid2">
                        <Field label="Name" tooltip="Your character's name.">
                            <input value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="e.g. Iris Vale" />
                        </Field>
                        <Field label="Role" tooltip="Protagonist, Antagonist, Mentor, etc.">
                            <input value={roleInStory} onChange={(e) => setRoleInStory(e.target.value)} placeholder="e.g. Protagonist" />
                        </Field>
                    </div>

                    <Field label="Background (optional)" tooltip="Their past and what shaped them.">
                        <textarea rows={2} value={background} onChange={(e) => setBackground(e.target.value)} placeholder="e.g. A former social worker turned memory-broker." />
                    </Field>

                    <div className="grid2">
                        <Field label="Traits" tooltip="Personality traits, one per line.">
                            <textarea rows={3} value={traitsText} onChange={(e) => setTraitsText(e.target.value)} placeholder={"empathetic\ncautious"} />
                        </Field>
                        <Field label="Motivations" tooltip="What drives them? One per line.">
                            <textarea rows={3} value={motivationsText} onChange={(e) => setMotivationsText(e.target.value)} placeholder={"protect her sibling\nrecover lost memories"} />
                        </Field>
                    </div>

                    <Field label="Fears" tooltip="What would break them? One per line.">
                        <textarea rows={2} value={fearsText} onChange={(e) => setFearsText(e.target.value)} placeholder="e.g. losing her identity" />
                    </Field>

                    <Field label="Relationships (Name: role, one per line)" tooltip="Other characters this person knows. Format: Lucan: rival">
                        <textarea rows={2} value={relationshipsText} onChange={(e) => setRelationshipsText(e.target.value)} placeholder={"Lucan Mercer: rival\nMara Quinn: mentor figure"} />
                    </Field>

                    <Field label="Variations" tooltip="Generate multiple versions to compare. 1–5.">
                        <input type="number" min={1} max={5} value={nVariations} onChange={(e) => setNVariations(e.target.value)} style={{ width: 70 }} />
                    </Field>
                </div>
            </aside>
        </div>
    );
}