import { useMemo, useState } from "react";
import "./app.css";

const API_BASE = "http://127.0.0.1:8000";

function linesToArray(s) {
    return s
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
}

function JsonPretty({ value }) {
    return <pre className="code">{JSON.stringify(value, null, 2)}</pre>;
}

export default function App() {
    // Sidebar "saved characters" (lightweight prototype)
    const [presets] = useState([
        { id: "p1", name: "Iris Vale", role: "Protagonist" },
        { id: "p2", name: "Lucan Mercer", role: "Antagonist" },
        { id: "p3", name: "Mara Quinn", role: "Mentor" },
    ]);
    const [selectedPreset, setSelectedPreset] = useState("p1");

    // Narrative input (right panel controls)
    const [title, setTitle] = useState("The City That Forgets");
    const [genre, setGenre] = useState("Urban Fantasy");
    const [setting, setSetting] = useState("A modern city where memories can be traded");
    const [theme, setTheme] = useState("Identity and sacrifice");
    const [constraintsText, setConstraintsText] = useState("Magic has a cost\nMemories cannot be restored fully");

    // Character input
    const [charName, setCharName] = useState("Iris Vale");
    const [roleInStory, setRoleInStory] = useState("Protagonist");
    const [background, setBackground] = useState("A former social worker turned memory-broker after a personal tragedy.");
    const [traitsText, setTraitsText] = useState("empathetic\ncautious");
    const [motivationsText, setMotivationsText] = useState("protect her sibling\nrecover lost memories");
    const [fearsText, setFearsText] = useState("losing her identity");
    const [nVariations, setNVariations] = useState(1);

    // Chat state
    const [messages, setMessages] = useState([
        {
            id: "m1",
            role: "system",
            text:
                "Narrative-first character generator prototype. Define a scenario + character, then generate profile/dialogue/scene with consistency checks.",
        },
    ]);
    const [input, setInput] = useState("");

    // Output panel (latest generation)
    const [activeTab, setActiveTab] = useState("profile"); // profile | dialogue | scene | consistency
    const [latest, setLatest] = useState(null);

    const constraints = useMemo(() => linesToArray(constraintsText), [constraintsText]);
    const personality_traits = useMemo(() => linesToArray(traitsText), [traitsText]);
    const motivations = useMemo(() => linesToArray(motivationsText), [motivationsText]);
    const fears = useMemo(() => linesToArray(fearsText), [fearsText]);

    function applyPreset(id) {
        setSelectedPreset(id);
        const p = presets.find((x) => x.id === id);
        if (!p) return;
        setCharName(p.name);
        setRoleInStory(p.role);
    }

    async function generate() {
        setMessages((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                role: "user",
                text:
                    input.trim() ||
                    `Generate outputs for ${charName} (${roleInStory}) inside "${title}" (${genre}).`,
            },
        ]);

        setInput("");

        // Small UX: show a typing bubble
        const typingId = crypto.randomUUID();
        setMessages((prev) => [...prev, { id: typingId, role: "assistant", text: "Generating..." }]);

        try {
            const res = await fetch(`${API_BASE}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    n_variations: Number(nVariations),
                    narrative: {
                        title,
                        genre,
                        setting,
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
                const msg = data?.detail ? String(data.detail) : "Generation failed";
                setMessages((prev) => prev.map((m) => (m.id === typingId ? { ...m, text: `Error: ${msg}` } : m)));
                return;
            }

            const first = (data.results || [])[0];
            setLatest(first || null);

            const assistantText = first
                ? `PROFILE:\n${first.profile}\n\nDIALOGUE:\n${first.dialogue}\n\nSCENE:\n${first.scene}`
                : "No results returned.";

            setMessages((prev) => prev.map((m) => (m.id === typingId ? { ...m, text: assistantText } : m)));
        } catch (e) {
            setMessages((prev) =>
                prev.map((m) => (m.id === typingId ? { ...m, text: `Error: ${String(e)}` } : m))
            );
        }
    }

    return (
        <div className="app">
            {/* Left Sidebar */}
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
                    {presets.map((p) => (
                        <button
                            key={p.id}
                            className={`item ${selectedPreset === p.id ? "active" : ""}`}
                            onClick={() => applyPreset(p.id)}
                            type="button"
                        >
                            <div className="itemName">{p.name}</div>
                            <div className="itemMeta">{p.role}</div>
                        </button>
                    ))}
                </div>

                <div className="hint">
                    Tip: this is a prototype UI. Next iterations will support saving profiles + prompt tuning presets.
                </div>
            </aside>

            {/* Main Chat */}
            <main className="main">
                <header className="topbar">
                    <div className="topbarLeft">
                        <div className="pill">API: {API_BASE}</div>
                        <div className="pill">Endpoint: /generate</div>
                    </div>
                    <div className="topbarRight">
                        <button className="btn ghost" type="button" onClick={() => setMessages(messages.slice(0, 1))}>
                            Clear chat
                        </button>
                    </div>
                </header>

                <section className="chat">
                    {messages.map((m) => (
                        <div key={m.id} className={`msg ${m.role}`}>
                            <div className="bubble">
                                <div className="role">{m.role}</div>
                                <div className="text" style={{ whiteSpace: "pre-wrap" }}>
                                    {m.text}
                                </div>
                            </div>
                        </div>
                    ))}
                </section>

                <footer className="composer">
                    <input
                        className="input"
                        placeholder="Ask for a generation (or leave blank and click Generate)…"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") generate();
                        }}
                    />
                    <button className="btn" type="button" onClick={generate}>
                        Generate
                    </button>
                </footer>
            </main>

            {/* Right Panel: Controls + Outputs */}
            <aside className="panel">
                <div className="panelTitle">Scenario + Character</div>

                <div className="form">
                    <div className="grid2">
                        <label>
                            <span>Title</span>
                            <input value={title} onChange={(e) => setTitle(e.target.value)} />
                        </label>
                        <label>
                            <span>Genre</span>
                            <input value={genre} onChange={(e) => setGenre(e.target.value)} />
                        </label>
                    </div>

                    <label>
                        <span>Setting</span>
                        <input value={setting} onChange={(e) => setSetting(e.target.value)} />
                    </label>

                    <label>
                        <span>Theme (optional)</span>
                        <input value={theme} onChange={(e) => setTheme(e.target.value)} />
                    </label>

                    <label>
                        <span>Constraints (one per line)</span>
                        <textarea rows={3} value={constraintsText} onChange={(e) => setConstraintsText(e.target.value)} />
                    </label>

                    <div className="divider" />

                    <div className="grid2">
                        <label>
                            <span>Name</span>
                            <input value={charName} onChange={(e) => setCharName(e.target.value)} />
                        </label>
                        <label>
                            <span>Role</span>
                            <input value={roleInStory} onChange={(e) => setRoleInStory(e.target.value)} />
                        </label>
                    </div>

                    <label>
                        <span>Background (optional)</span>
                        <textarea rows={3} value={background} onChange={(e) => setBackground(e.target.value)} />
                    </label>

                    <div className="grid2">
                        <label>
                            <span>Traits</span>
                            <textarea rows={3} value={traitsText} onChange={(e) => setTraitsText(e.target.value)} />
                        </label>
                        <label>
                            <span>Motivations</span>
                            <textarea rows={3} value={motivationsText} onChange={(e) => setMotivationsText(e.target.value)} />
                        </label>
                    </div>

                    <label>
                        <span>Fears</span>
                        <textarea rows={2} value={fearsText} onChange={(e) => setFearsText(e.target.value)} />
                    </label>

                    <label className="row">
                        <span>Variations</span>
                        <input
                            type="number"
                            min={1}
                            max={5}
                            value={nVariations}
                            onChange={(e) => setNVariations(e.target.value)}
                            style={{ width: 80 }}
                        />
                    </label>
                </div>

                <div className="panelTitle">Latest Output</div>

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

                <div className="output">
                    {!latest && <div className="muted">Generate to see results here.</div>}

                    {latest && activeTab === "profile" && <div className="outText">{latest.profile}</div>}
                    {latest && activeTab === "dialogue" && <div className="outText">{latest.dialogue}</div>}
                    {latest && activeTab === "scene" && <div className="outText">{latest.scene}</div>}
                    {latest && activeTab === "consistency" && <JsonPretty value={latest.consistency_report} />}
                </div>
            </aside>
        </div>
    );
}
