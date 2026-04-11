import { useMemo, useState } from "react";
import "./app.css";

const API_BASE = "http://127.0.0.1:8000";

function linesToArray(s) {
    return s.split("\n").map((x) => x.trim()).filter(Boolean);
}

function JsonPretty({ value }) {
    return <pre className="code">{JSON.stringify(value, null, 2)}</pre>;
}

function Field({ label, tooltip, children }) {
    return (
        <label className="fieldWrap">
      <span className="fieldLabel">
        {label}
          <span className="tooltip">{tooltip}</span>
      </span>
            {children}
        </label>
    );
}

export default function App() {
    const [presets] = useState([
        { id: "p1", name: "Iris Vale", role: "Protagonist" },
        { id: "p2", name: "Lucan Mercer", role: "Antagonist" },
        { id: "p3", name: "Mara Quinn", role: "Mentor" },
    ]);
    const [selectedPreset, setSelectedPreset] = useState(null);

    // Narrative inputs — empty by default
    const [title, setTitle] = useState("");
    const [genre, setGenre] = useState("");
    const [setting, setSetting] = useState("");
    const [theme, setTheme] = useState("");
    const [constraintsText, setConstraintsText] = useState("");

    // Character inputs — empty by default
    const [charName, setCharName] = useState("");
    const [roleInStory, setRoleInStory] = useState("");
    const [background, setBackground] = useState("");
    const [traitsText, setTraitsText] = useState("");
    const [motivationsText, setMotivationsText] = useState("");
    const [fearsText, setFearsText] = useState("");
    const [nVariations, setNVariations] = useState(1);

    const [messages, setMessages] = useState([
        {
            id: "m1",
            role: "system",
            text: "Narrative-first character generator. Define a scenario and character on the right, then click Generate.",
        },
    ]);
    const [input, setInput] = useState("");
    const [activeTab, setActiveTab] = useState("profile");
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
                text: input.trim() || `Generate outputs for ${charName || "character"} (${roleInStory || "role"}) inside "${title || "untitled"}" (${genre || "no genre"}).`,
            },
        ]);
        setInput("");

        const typingId = crypto.randomUUID();
        setMessages((prev) => [...prev, { id: typingId, role: "assistant", text: "Generating…" }]);

        try {
            const res = await fetch(`${API_BASE}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    n_variations: Number(nVariations),
                    narrative: { title, genre, setting, theme, high_level_plot: null, constraints },
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
            setMessages((prev) => prev.map((m) => (m.id === typingId ? { ...m, text: `Error: ${String(e)}` } : m)));
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
                    Select a character template to pre-fill the form, or define your own from scratch on the right.
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
                                <div className="text" style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                            </div>
                        </div>
                    ))}
                </section>

                <footer className="composer">
                    <input
                        className="input"
                        placeholder="Leave blank and click Generate, or type a note first…"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") generate(); }}
                    />
                    <button className="btn" type="button" onClick={generate}>Generate</button>
                </footer>
            </main>

            {/* Right Panel */}
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

                    <Field label="Setting" tooltip="Where and when the story takes place. Be specific — it grounds the AI output.">
                        <input value={setting} onChange={(e) => setSetting(e.target.value)} placeholder="e.g. A city where memories can be bought and sold" />
                    </Field>

                    <Field label="Theme (optional)" tooltip="The central idea or question your story explores — e.g. identity, power, sacrifice.">
                        <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Identity and sacrifice" />
                    </Field>

                    <Field label="Constraints (one per line)" tooltip="Rules of your world that the AI must not break — e.g. 'Magic has a cost'. One per line.">
                        <textarea rows={3} value={constraintsText} onChange={(e) => setConstraintsText(e.target.value)} placeholder={"Magic has a cost\nMemories cannot be fully restored"} />
                    </Field>

                    <div className="divider" />
                    <div className="panelTitle" style={{ marginTop: 0 }}>Character</div>

                    <div className="grid2">
                        <Field label="Name" tooltip="Your character's name. This will appear throughout all generated outputs.">
                            <input value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="e.g. Iris Vale" />
                        </Field>
                        <Field label="Role" tooltip="Their narrative role — e.g. Protagonist, Antagonist, Mentor, Sidekick.">
                            <input value={roleInStory} onChange={(e) => setRoleInStory(e.target.value)} placeholder="e.g. Protagonist" />
                        </Field>
                    </div>

                    <Field label="Background (optional)" tooltip="A brief history — their past, what shaped them, and where they came from.">
                        <textarea rows={3} value={background} onChange={(e) => setBackground(e.target.value)} placeholder="e.g. A former social worker turned memory-broker after a personal tragedy." />
                    </Field>

                    <div className="grid2">
                        <Field label="Traits" tooltip="Personality traits, one per line — e.g. empathetic, impulsive, secretive.">
                            <textarea rows={3} value={traitsText} onChange={(e) => setTraitsText(e.target.value)} placeholder={"empathetic\ncautious"} />
                        </Field>
                        <Field label="Motivations" tooltip="What drives them? What do they want or need? One per line.">
                            <textarea rows={3} value={motivationsText} onChange={(e) => setMotivationsText(e.target.value)} placeholder={"protect her sibling\nrecover lost memories"} />
                        </Field>
                    </div>

                    <Field label="Fears" tooltip="What are they afraid of, or what would break them? One per line.">
                        <textarea rows={2} value={fearsText} onChange={(e) => setFearsText(e.target.value)} placeholder="e.g. losing her identity" />
                    </Field>

                    <Field label="Variations" tooltip="Generate multiple versions to compare outputs. 1–5.">
                        <input type="number" min={1} max={5} value={nVariations} onChange={(e) => setNVariations(e.target.value)} style={{ width: 80 }} />
                    </Field>
                </div>

                <div className="panelTitle">Latest Output</div>

                <div className="tabs">
                    {["profile", "dialogue", "scene", "consistency"].map((t) => (
                        <button key={t} type="button" className={`tab ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>
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