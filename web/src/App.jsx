import { useMemo, useState, useRef } from "react";
import "./app.css";

const API_BASE = "http://127.0.0.1:8000";

function linesToArray(s) {
    return s.split("\n").map((x) => x.trim()).filter(Boolean);
}

function JsonPretty({ value }) {
    return <pre className="code">{JSON.stringify(value, null, 2)}</pre>;
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

// Generates a stable position for a location node on the map canvas
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
    // ── Sidebar characters ──
    const [characters, setCharacters] = useState([
        { id: "c1", name: "Iris Vale", role: "Protagonist", locationId: null },
        { id: "c2", name: "Lucan Mercer", role: "Antagonist", locationId: null },
        { id: "c3", name: "Mara Quinn", role: "Mentor", locationId: null },
    ]);
    const [selectedChar, setSelectedChar] = useState(null);

    // ── Map / locations ──
    const [locations, setLocations] = useState([]);
    const [activeLocationId, setActiveLocationId] = useState(null);
    const [newLocName, setNewLocName] = useState("");
    const [newLocDesc, setNewLocDesc] = useState("");
    const [showAddLoc, setShowAddLoc] = useState(false);
    const [dragging, setDragging] = useState(null); // { id, startX, startY }
    const [positions, setPositions] = useState({}); // { locId: {x, y} }
    const mapRef = useRef(null);

    // ── Scenario inputs ──
    const [title, setTitle] = useState("");
    const [genre, setGenre] = useState("");
    const [setting, setSetting] = useState("");
    const [theme, setTheme] = useState("");
    const [constraintsText, setConstraintsText] = useState("");

    // ── Character inputs ──
    const [charName, setCharName] = useState("");
    const [roleInStory, setRoleInStory] = useState("");
    const [background, setBackground] = useState("");
    const [traitsText, setTraitsText] = useState("");
    const [motivationsText, setMotivationsText] = useState("");
    const [fearsText, setFearsText] = useState("");
    const [nVariations, setNVariations] = useState(1);

    // ── Output ──
    const [activeTab, setActiveTab] = useState("profile");
    const [latest, setLatest] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [statusMsg, setStatusMsg] = useState("");

    const constraints = useMemo(() => linesToArray(constraintsText), [constraintsText]);
    const personality_traits = useMemo(() => linesToArray(traitsText), [traitsText]);
    const motivations = useMemo(() => linesToArray(motivationsText), [motivationsText]);
    const fears = useMemo(() => linesToArray(fearsText), [fearsText]);

    const activeLocation = locations.find((l) => l.id === activeLocationId) || null;

    // ── Load character into form ──
    function selectChar(c) {
        setSelectedChar(c.id);
        setCharName(c.name);
        setRoleInStory(c.role);
    }

    // ── Map: add location ──
    function addLocation() {
        if (!newLocName.trim()) return;
        const id = crypto.randomUUID();
        const newLoc = { id, name: newLocName.trim(), description: newLocDesc.trim(), tags: [] };
        const updated = [...locations, newLoc];
        setLocations(updated);
        // Auto-position in a circle
        const idx = updated.length - 1;
        const pos = getNodePosition(idx, updated.length);
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
        setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, locationId: locId } : c));
    }

    // ── Map drag ──
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

    // ── Generate ──
    async function generate() {
        setGenerating(true);
        setStatusMsg("Generating…");
        setLatest(null);

        // Build location context to inject into the prompt
        const locationContext = activeLocation
            ? `\nActive Location: ${activeLocation.name}${activeLocation.description ? ` — ${activeLocation.description}` : ""}`
            : "";

        // Characters at the active location
        const charsAtLocation = characters.filter((c) => c.locationId === activeLocationId);
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
                        relationships: {},
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
        } catch (e) {
            setStatusMsg(`Error: ${String(e)}`);
        } finally {
            setGenerating(false);
        }
    }

    return (
        <div className="app">
            {/* ── Left Sidebar ── */}
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

                {/* Assign selected character to location */}
                {selectedChar && locations.length > 0 && (
                    <div className="assignBox">
                        <div className="sectionTitle" style={{ marginTop: 0 }}>Assign to location</div>
                        <select
                            className="selectInput"
                            value={characters.find((c) => c.id === selectedChar)?.locationId || ""}
                            onChange={(e) => assignCharToLocation(selectedChar, e.target.value || null)}
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

            {/* ── Centre: Map + Output ── */}
            <main className="main">
                {/* Map panel */}
                <div className="mapPanel">
                    <div className="mapHeader">
                        <span className="mapTitle">🗺 Narrative Map — {title || "Untitled Scenario"}</span>
                        <button className="btn ghost small" type="button" onClick={() => setShowAddLoc((v) => !v)}>
                            + Add Location
                        </button>
                    </div>

                    {showAddLoc && (
                        <div className="addLocForm">
                            <input
                                className="input small"
                                placeholder="Location name…"
                                value={newLocName}
                                onChange={(e) => setNewLocName(e.target.value)}
                            />
                            <input
                                className="input small"
                                placeholder="Short description (optional)…"
                                value={newLocDesc}
                                onChange={(e) => setNewLocDesc(e.target.value)}
                            />
                            <button className="btn small" type="button" onClick={addLocation}>Add</button>
                            <button className="btn ghost small" type="button" onClick={() => setShowAddLoc(false)}>Cancel</button>
                        </div>
                    )}

                    {/* Map canvas */}
                    <div
                        className="mapCanvas"
                        ref={mapRef}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                    >
                        {locations.length === 0 && (
                            <div className="mapEmpty">Add locations to build your narrative world map.</div>
                        )}

                        {/* Draw connection lines between locations */}
                        <svg className="mapSvg">
                            {locations.map((loc, i) =>
                                locations.slice(i + 1).map((loc2) => {
                                    const p1 = positions[loc.id] || getNodePosition(i, locations.length);
                                    const p2 = positions[loc2.id] || getNodePosition(i + 1, locations.length);
                                    return (
                                        <line
                                            key={`${loc.id}-${loc2.id}`}
                                            x1={`${p1.x}%`} y1={`${p1.y}%`}
                                            x2={`${p2.x}%`} y2={`${p2.y}%`}
                                            stroke="rgba(124,92,255,0.15)"
                                            strokeWidth="1"
                                            strokeDasharray="4 4"
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
                                            {charsHere.map((c) => (
                                                <span key={c.id} className="charTag">{c.name.split(" ")[0]}</span>
                                            ))}
                                        </div>
                                    )}
                                    <button
                                        className="nodeRemove"
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); removeLocation(loc.id); }}
                                    >×</button>
                                </div>
                            );
                        })}
                    </div>

                    {activeLocation && (
                        <div className="activeLocBar">
                            <span>📍 Active location: <strong>{activeLocation.name}</strong></span>
                            {activeLocation.description && <span className="muted"> — {activeLocation.description}</span>}
                            <span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>This location will be injected into generation</span>
                        </div>
                    )}
                </div>

                {/* Output panel */}
                <div className="outputPanel">
                    <div className="outputHeader">
                        <div className="tabs">
                            {["profile", "dialogue", "scene", "consistency"].map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    className={`tab ${activeTab === t ? "active" : ""}`}
                                    onClick={() => setActiveTab(t)}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        <button className="btn" type="button" onClick={generate} disabled={generating}>
                            {generating ? "Generating…" : "Generate"}
                        </button>
                    </div>

                    {statusMsg && <div className="statusMsg">{statusMsg}</div>}

                    <div className="output">
                        {!latest && <div className="muted">Fill in the scenario and character on the right, then click Generate.</div>}
                        {latest && activeTab === "profile" && <div className="outText">{latest.profile}</div>}
                        {latest && activeTab === "dialogue" && <div className="outText">{latest.dialogue}</div>}
                        {latest && activeTab === "scene" && <div className="outText">{latest.scene}</div>}
                        {latest && activeTab === "consistency" && <JsonPretty value={latest.consistency_report} />}
                    </div>
                </div>
            </main>

            {/* ── Right Panel: Scenario + Character form ── */}
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

                    <Field label="Theme (optional)" tooltip="The central idea your story explores — e.g. identity, sacrifice.">
                        <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Identity and sacrifice" />
                    </Field>

                    <Field label="Constraints (one per line)" tooltip="Rules of your world the AI must not break. One per line.">
                        <textarea rows={3} value={constraintsText} onChange={(e) => setConstraintsText(e.target.value)} placeholder={"Magic has a cost\nMemories cannot be fully restored"} />
                    </Field>

                    <div className="divider" />
                    <div className="panelTitle" style={{ marginTop: 0 }}>Character</div>

                    <div className="grid2">
                        <Field label="Name" tooltip="Your character's name.">
                            <input value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="e.g. Iris Vale" />
                        </Field>
                        <Field label="Role" tooltip="Their narrative role — Protagonist, Antagonist, Mentor, etc.">
                            <input value={roleInStory} onChange={(e) => setRoleInStory(e.target.value)} placeholder="e.g. Protagonist" />
                        </Field>
                    </div>

                    <Field label="Background (optional)" tooltip="A brief history — their past and what shaped them.">
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

                    <Field label="Variations" tooltip="Generate multiple versions to compare. 1–5.">
                        <input type="number" min={1} max={5} value={nVariations} onChange={(e) => setNVariations(e.target.value)} style={{ width: 70 }} />
                    </Field>
                </div>
            </aside>
        </div>
    );
}