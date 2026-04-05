import { useState, useEffect, useRef, useReducer, useCallback } from "react";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const today = () => new Date().toLocaleDateString([], { month: "short", day: "numeric" });
const useIsMobile = () => {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
};

async function callClaude(messages, systemPrompt = "") {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1000,
      system: systemPrompt || "You are a helpful AI assistant. Be concise and clear.",
      messages,
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

const initialState = {
  conversations: [], activeConvId: null, notes: [],
  stats: { totalChats: 0, toolsUsed: 0, notesCreated: 0, messagesTotal: 0 },
  currentView: "chat", sidebarOpen: true,
};

function reducer(state, action) {
  switch (action.type) {
    case "NEW_CONV": {
      const conv = { id: uid(), title: "New conversation", messages: [], createdAt: today() };
      return { ...state, conversations: [conv, ...state.conversations], activeConvId: conv.id, stats: { ...state.stats, totalChats: state.stats.totalChats + 1 } };
    }
    case "ADD_MSG": {
      const convs = state.conversations.map((c) => {
        if (c.id !== action.convId) return c;
        const msgs = [...c.messages, action.msg];
        const title = msgs[0]?.role === "user" && c.title === "New conversation"
          ? msgs[0].content.slice(0, 38) + (msgs[0].content.length > 38 ? "…" : "") : c.title;
        return { ...c, messages: msgs, title };
      });
      return { ...state, conversations: convs, stats: { ...state.stats, messagesTotal: state.stats.messagesTotal + 1 } };
    }
    case "SET_CONV": return { ...state, activeConvId: action.id };
    case "DELETE_CONV": {
      const convs = state.conversations.filter((c) => c.id !== action.id);
      return { ...state, conversations: convs, activeConvId: state.activeConvId === action.id ? convs[0]?.id ?? null : state.activeConvId };
    }
    case "ADD_NOTE": return { ...state, notes: [action.note, ...state.notes], stats: { ...state.stats, notesCreated: state.stats.notesCreated + 1 } };
    case "DELETE_NOTE": return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };
    case "TOOL_USED": return { ...state, stats: { ...state.stats, toolsUsed: state.stats.toolsUsed + 1 } };
    case "SET_VIEW": return { ...state, currentView: action.view };
    case "TOGGLE_SIDEBAR": return { ...state, sidebarOpen: !state.sidebarOpen };
    default: return state;
  }
}

const Icon = ({ name, size = 18, color = "currentColor" }) => {
  const icons = {
    chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    tools: <><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></>,
    dashboard: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    history: <><polyline points="12 8 12 12 14 14" /><path d="M3.05 11a9 9 0 1 0 .5-4" /><polyline points="3 3 3 8 8 8" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    send: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    summarize: <><line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="7" y2="18" /></>,
    note: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
    code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
    bot: <><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" /></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
    star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
    check: <polyline points="20 6 9 17 4 12" />,
    back: <polyline points="15 18 9 12 15 6" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

const LoadingDots = () => (
  <span style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
    {[0, 1, 2].map((i) => (
      <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#666", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
    ))}
    <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
  </span>
);

const Sidebar = ({ state, dispatch }) => {
  const nav = [
    { id: "chat", label: "Chat", icon: "chat" },
    { id: "tools", label: "Tools", icon: "tools" },
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "history", label: "History", icon: "history" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];
  return (
    <aside style={{ width: state.sidebarOpen ? 220 : 60, minWidth: state.sidebarOpen ? 220 : 60, background: "#000", borderRight: "0.5px solid #222", display: "flex", flexDirection: "column", transition: "width 0.2s ease, min-width 0.2s ease", overflow: "hidden", zIndex: 10 }}>
      <div style={{ padding: "16px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "0.5px solid #222" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#6C63FF,#4ECDC4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>C</span>
        </div>
        {state.sidebarOpen && <span style={{ fontWeight: 600, fontSize: 15, color: "#fff", whiteSpace: "nowrap" }}>Chat AI</span>}
      </div>
      <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {nav.map((item) => {
          const active = state.currentView === item.id;
          return (
            <button key={item.id} onClick={() => dispatch({ type: "SET_VIEW", view: item.id })} title={!state.sidebarOpen ? item.label : ""}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", background: active ? "#1a1a1a" : "transparent", color: active ? "#fff" : "#888", fontWeight: active ? 500 : 400, fontSize: 13, transition: "background 0.15s", whiteSpace: "nowrap" }}>
              <span style={{ flexShrink: 0 }}><Icon name={item.icon} size={16} color={active ? "#fff" : "#888"} /></span>
              {state.sidebarOpen && item.label}
            </button>
          );
        })}
      </nav>
      {state.currentView === "chat" && (
        <div style={{ padding: "10px 8px", borderTop: "0.5px solid #222" }}>
          <button onClick={() => { dispatch({ type: "NEW_CONV" }); dispatch({ type: "SET_VIEW", view: "chat" }); }}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 10px", borderRadius: 8, border: "0.5px solid #333", background: "transparent", cursor: "pointer", color: "#888", fontSize: 13, justifyContent: state.sidebarOpen ? "flex-start" : "center" }}>
            <Icon name="plus" size={15} color="#888" />
            {state.sidebarOpen && "New chat"}
          </button>
        </div>
      )}
      <button onClick={() => dispatch({ type: "TOGGLE_SIDEBAR" })}
        style={{ padding: "12px 14px", border: "none", background: "transparent", cursor: "pointer", color: "#666", borderTop: "0.5px solid #222", display: "flex", alignItems: "center", gap: 8, justifyContent: state.sidebarOpen ? "flex-start" : "center", fontSize: 12 }}>
        <Icon name={state.sidebarOpen ? "x" : "menu"} size={14} color="#666" />
        {state.sidebarOpen && "Collapse"}
      </button>
    </aside>
  );
};

const MobileNav = ({ state, dispatch }) => {
  const nav = [
    { id: "chat", label: "Chat", icon: "chat" },
    { id: "tools", label: "Tools", icon: "tools" },
    { id: "dashboard", label: "Stats", icon: "dashboard" },
    { id: "history", label: "History", icon: "history" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];
  return (
    <nav style={{ display: "flex", background: "#000", borderTop: "0.5px solid #222", padding: "6px 0 10px", flexShrink: 0 }}>
      {nav.map((item) => {
        const active = state.currentView === item.id;
        return (
          <button key={item.id} onClick={() => dispatch({ type: "SET_VIEW", view: item.id })}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, border: "none", background: "transparent", cursor: "pointer", padding: "6px 0", color: active ? "#6C63FF" : "#555" }}>
            <Icon name={item.icon} size={20} color={active ? "#6C63FF" : "#555"} />
            <span style={{ fontSize: 10, fontWeight: active ? 500 : 400 }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

const ChatView = ({ state, dispatch, isMobile }) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConvList, setShowConvList] = useState(false);
  const bottomRef = useRef(null);
  const activeConv = state.conversations.find((c) => c.id === state.activeConvId);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeConv?.messages]);

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const convId = state.activeConvId ?? state.conversations[0]?.id;
    if (!convId) return;
    const userMsg = { id: uid(), role: "user", content: input.trim(), time: now() };
    dispatch({ type: "ADD_MSG", convId, msg: userMsg });
    setInput(""); setLoading(true);
    try {
      const conv = state.conversations.find((c) => c.id === convId);
      const history = (conv?.messages ?? []).map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: input.trim() });
      const reply = await callClaude(history);
      dispatch({ type: "ADD_MSG", convId, msg: { id: uid(), role: "assistant", content: reply, time: now() } });
    } catch {
      dispatch({ type: "ADD_MSG", convId, msg: { id: uid(), role: "assistant", content: "Sorry, I couldn't connect to the AI. Please check your API key.", time: now() } });
    } finally { setLoading(false); }
  }, [input, loading, state, dispatch]);

  if (isMobile && showConvList) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0a0a" }}>
        <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #222", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setShowConvList(false)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4 }}>
            <Icon name="back" size={20} color="#888" />
          </button>
          <span style={{ fontSize: 15, fontWeight: 500, color: "#fff" }}>Conversations</span>
          <button onClick={() => { dispatch({ type: "NEW_CONV" }); setShowConvList(false); }}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "0.5px solid #333", background: "transparent", cursor: "pointer", color: "#888", fontSize: 13 }}>
            <Icon name="plus" size={14} color="#888" />New
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {state.conversations.map((conv) => (
            <div key={conv.id} onClick={() => { dispatch({ type: "SET_CONV", id: conv.id }); setShowConvList(false); }}
              style={{ padding: "12px 14px", borderRadius: 10, marginBottom: 6, background: conv.id === state.activeConvId ? "#1a1a2e" : "#111", border: "0.5px solid #222", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ overflow: "hidden" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conv.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#555" }}>{conv.messages.length} msgs · {conv.createdAt}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); dispatch({ type: "DELETE_CONV", id: conv.id }); }}
                style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, flexShrink: 0 }}>
                <Icon name="trash" size={14} color="#555" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {!isMobile && (
        <div style={{ width: 200, borderRight: "0.5px solid #222", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0a0a" }}>
          <div style={{ padding: "12px 12px 8px", fontSize: 11, fontWeight: 500, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 8px" }}>
            {state.conversations.length === 0 && <p style={{ padding: "8px 6px", fontSize: 12, color: "#555" }}>No chats yet.</p>}
            {state.conversations.map((conv) => (
              <div key={conv.id} onClick={() => dispatch({ type: "SET_CONV", id: conv.id })}
                style={{ padding: "8px 10px", borderRadius: 7, cursor: "pointer", marginBottom: 2, background: conv.id === state.activeConvId ? "#1a1a2e" : "transparent", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div style={{ overflow: "hidden" }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conv.title}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#555" }}>{conv.createdAt}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); dispatch({ type: "DELETE_CONV", id: conv.id }); }}
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "#555", padding: 2, borderRadius: 4, flexShrink: 0 }}>
                  <Icon name="trash" size={12} color="#555" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#111" }}>
        {isMobile && (
          <div style={{ padding: "10px 14px", borderBottom: "0.5px solid #222", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0a0a", flexShrink: 0 }}>
            <span style={{ fontSize: 13, color: "#ddd", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
              {activeConv?.title ?? "New conversation"}
            </span>
            <button onClick={() => setShowConvList(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, border: "0.5px solid #333", background: "transparent", cursor: "pointer", color: "#888", fontSize: 12, flexShrink: 0 }}>
              <Icon name="history" size={13} color="#888" />Chats
            </button>
          </div>
        )}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px 12px" : "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {!activeConv || activeConv.messages.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#555", minHeight: 200 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: "#1a1a2e", border: "0.5px solid #333", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="bot" size={24} color="#6C63FF" />
              </div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#ddd" }}>How can I help you today?</p>
              <p style={{ margin: 0, fontSize: 13 }}>Ask me anything — I'm ready to assist.</p>
            </div>
          ) : activeConv.messages.map((msg) => (
            <div key={msg.id} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 8, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: msg.role === "user" ? "linear-gradient(135deg,#6C63FF,#9B8EFF)" : "linear-gradient(135deg,#4ECDC4,#44A3AA)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={msg.role === "user" ? "user" : "bot"} size={13} color="#fff" />
              </div>
              <div style={{ maxWidth: isMobile ? "82%" : "70%" }}>
                <div style={{ padding: "10px 14px", borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px", background: msg.role === "user" ? "linear-gradient(135deg,#6C63FF,#9B8EFF)" : "#1c1c1c", color: "#e8e8e8", fontSize: isMobile ? 14 : 13.5, lineHeight: 1.6, border: msg.role !== "user" ? "0.5px solid #2a2a2a" : "none", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {msg.content}
                </div>
                <p style={{ margin: "4px 4px 0", fontSize: 10.5, color: "#555", textAlign: msg.role === "user" ? "right" : "left" }}>{msg.time}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#4ECDC4,#44A3AA)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="bot" size={13} color="#fff" />
              </div>
              <div style={{ padding: "12px 16px", borderRadius: "4px 16px 16px 16px", background: "#1c1c1c", border: "0.5px solid #2a2a2a" }}>
                <LoadingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: isMobile ? "10px 12px 12px" : "12px 24px 16px", borderTop: "0.5px solid #222", background: "#0d0d0d" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "#1a1a1a", border: "0.5px solid #333", borderRadius: 14, padding: "8px 8px 8px 14px" }}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Message Chat AI…" rows={1}
              style={{ flex: 1, border: "none", background: "transparent", resize: "none", fontSize: isMobile ? 15 : 13.5, color: "#e8e8e8", outline: "none", maxHeight: 120, overflowY: "auto", lineHeight: 1.5, padding: "2px 0", fontFamily: "inherit" }} />
            <button onClick={send} disabled={!input.trim() || loading}
              style={{ width: 36, height: 36, borderRadius: 10, border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed", background: input.trim() && !loading ? "linear-gradient(135deg,#6C63FF,#9B8EFF)" : "#222", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: input.trim() && !loading ? 1 : 0.4 }}>
              <Icon name="send" size={15} color={input.trim() && !loading ? "#fff" : "#555"} />
            </button>
          </div>
          {!isMobile && <p style={{ margin: "6px 0 0", fontSize: 11, color: "#444", textAlign: "center" }}>Shift+Enter for new line · Enter to send</p>}
        </div>
      </div>
    </div>
  );
};

const ToolsView = ({ state, dispatch, isMobile }) => {
  const [activeTool, setActiveTool] = useState("summarizer");
  const [toolInput, setToolInput] = useState("");
  const [toolOutput, setToolOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const tools = [
    { id: "summarizer", label: "Summarizer", icon: "summarize", color: "#6C63FF" },
    { id: "notes", label: "Notes", icon: "note", color: "#4ECDC4" },
    { id: "code", label: "Code", icon: "code", color: "#FF6B6B" },
  ];
  const systemPrompts = {
    summarizer: "You are a text summarizer. Produce a concise bullet-point summary. Use '•' for bullets.",
    notes: "You are a notes generator. Turn content into structured notes with headings (##), sub-points (•), and a 'Key Takeaways' section.",
    code: "You are a code explainer. Explain what the code does in plain English, step by step.",
  };
  const run = async () => {
    if (!toolInput.trim() || loading) return;
    setLoading(true); setToolOutput("");
    try {
      const result = await callClaude([{ role: "user", content: toolInput }], systemPrompts[activeTool]);
      setToolOutput(result); dispatch({ type: "TOOL_USED" });
    } catch { setToolOutput("Connection error. Please check your API configuration."); }
    finally { setLoading(false); }
  };
  const active = tools.find((t) => t.id === activeTool);
  return (
    <div style={{ padding: isMobile ? "16px 12px" : "24px", overflowY: "auto", height: "100%", background: "#111" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 18 : 20, fontWeight: 600, color: "#fff" }}>Smart Tools</h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "#666" }}>AI-powered utilities</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {tools.map((t) => (
          <button key={t.id} onClick={() => { setActiveTool(t.id); setToolInput(""); setToolOutput(""); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: activeTool === t.id ? `1.5px solid ${t.color}` : "0.5px solid #2a2a2a", background: activeTool === t.id ? t.color + "22" : "#1a1a1a", cursor: "pointer", fontSize: 13, fontWeight: activeTool === t.id ? 500 : 400, color: activeTool === t.id ? t.color : "#777" }}>
            <Icon name={t.icon} size={14} color={activeTool === t.id ? t.color : "#777"} />{t.label}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
        <div style={{ background: "#1a1a1a", border: "0.5px solid #2a2a2a", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Icon name={active.icon} size={15} color={active.color} />
            <span style={{ fontSize: 13, fontWeight: 500, color: "#ddd" }}>Input</span>
          </div>
          <textarea value={toolInput} onChange={(e) => setToolInput(e.target.value)}
            placeholder={activeTool === "code" ? "Paste your code here…" : activeTool === "notes" ? "Paste content to convert…" : "Paste text to summarize…"}
            style={{ width: "100%", minHeight: isMobile ? 130 : 200, border: "0.5px solid #333", borderRadius: 8, padding: "10px 12px", fontSize: 13, lineHeight: 1.6, color: "#e8e8e8", background: "#111", resize: "vertical", fontFamily: activeTool === "code" ? "monospace" : "inherit", outline: "none", boxSizing: "border-box" }} />
          <button onClick={run} disabled={!toolInput.trim() || loading}
            style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 8, border: "none", cursor: toolInput.trim() && !loading ? "pointer" : "not-allowed", background: toolInput.trim() && !loading ? active.color : "#222", color: toolInput.trim() && !loading ? "#fff" : "#555", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><LoadingDots /><span style={{ marginLeft: 6 }}>Processing…</span></> : <>Run {active.label}</>}
          </button>
        </div>
        <div style={{ background: "#1a1a1a", border: "0.5px solid #2a2a2a", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="star" size={15} color={active.color} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "#ddd" }}>Output</span>
            </div>
            {toolOutput && (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { navigator.clipboard.writeText(toolOutput); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: "0.5px solid #333", background: "transparent", cursor: "pointer", fontSize: 11, color: "#777" }}>
                  <Icon name={copied ? "check" : "copy"} size={12} color="#777" />{copied ? "Copied" : "Copy"}
                </button>
                <button onClick={() => { if (!toolOutput) return; dispatch({ type: "ADD_NOTE", note: { id: uid(), title: `${active.label} result`, content: toolOutput, createdAt: today() } }); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: "0.5px solid #333", background: "transparent", cursor: "pointer", fontSize: 11, color: "#777" }}>
                  <Icon name="note" size={12} color="#777" />Save
                </button>
              </div>
            )}
          </div>
          <div style={{ minHeight: isMobile ? 120 : 200, maxHeight: 340, overflowY: "auto", background: "#111", borderRadius: 8, padding: "10px 12px", fontSize: 13, lineHeight: 1.7, color: toolOutput ? "#e8e8e8" : "#555", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: activeTool === "code" && toolOutput ? "monospace" : "inherit", border: "0.5px solid #2a2a2a" }}>
            {toolOutput || (loading ? <LoadingDots /> : "Output will appear here…")}
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardView = ({ state, isMobile }) => {
  const statCards = [
    { label: "Total chats", value: state.stats.totalChats, icon: "chat", color: "#6C63FF" },
    { label: "Tools used", value: state.stats.toolsUsed, icon: "tools", color: "#4ECDC4" },
    { label: "Notes created", value: state.stats.notesCreated, icon: "note", color: "#FF6B6B" },
    { label: "Messages sent", value: state.stats.messagesTotal, icon: "send", color: "#FFC857" },
  ];
  return (
    <div style={{ padding: isMobile ? "16px 12px" : "24px", overflowY: "auto", height: "100%", background: "#111" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 18 : 20, fontWeight: 600, color: "#fff" }}>Dashboard</h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "#666" }}>Your workspace at a glance</p>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {statCards.map((s) => (
          <div key={s.label} style={{ background: "#1a1a1a", border: "0.5px solid #2a2a2a", borderRadius: 12, padding: "14px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "#666" }}>{s.label}</span>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: s.color + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={s.icon} size={13} color={s.color} />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: isMobile ? 22 : 26, fontWeight: 600, color: "#fff" }}>{s.value}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
        <div style={{ background: "#1a1a1a", border: "0.5px solid #2a2a2a", borderRadius: 12, padding: 14 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 500, color: "#ddd" }}>Recent conversations</h3>
          {state.conversations.length === 0 ? <p style={{ fontSize: 13, color: "#555" }}>No conversations yet.</p>
            : state.conversations.slice(0, 5).map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "0.5px solid #222" }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: "#6C63FF20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="chat" size={12} color="#6C63FF" />
                </div>
                <div style={{ overflow: "hidden" }}>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#555" }}>{c.messages.length} msgs · {c.createdAt}</p>
                </div>
              </div>
            ))}
        </div>
        <div style={{ background: "#1a1a1a", border: "0.5px solid #2a2a2a", borderRadius: 12, padding: 14 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 500, color: "#ddd" }}>Saved notes</h3>
          {state.notes.length === 0 ? <p style={{ fontSize: 13, color: "#555" }}>No notes yet. Use Tools to generate and save notes.</p>
            : state.notes.slice(0, 4).map((n) => (
              <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "0.5px solid #222" }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: "#4ECDC420", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="note" size={12} color="#4ECDC4" />
                </div>
                <div style={{ overflow: "hidden" }}>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#555" }}>{n.createdAt}</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

const HistoryView = ({ state, dispatch, isMobile }) => {
  const [search, setSearch] = useState("");
  const filtered = state.conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.messages.some((m) => m.content.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div style={{ padding: isMobile ? "16px 12px" : "24px", overflowY: "auto", height: "100%", background: "#111" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 18 : 20, fontWeight: 600, color: "#fff" }}>History</h2>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#666" }}>All past conversations and saved notes</p>
      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…"
        style={{ width: "100%", marginBottom: 16, boxSizing: "border-box", background: "#1a1a1a", border: "0.5px solid #333", color: "#e8e8e8", borderRadius: 8, padding: "10px 12px", fontSize: 13, outline: "none" }} />
      <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 500, color: "#555" }}>Conversations ({filtered.length})</h3>
      {filtered.length === 0
        ? <div style={{ textAlign: "center", padding: "40px 0", color: "#555", fontSize: 13 }}>{search ? "No matches found." : "No conversations yet."}</div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((conv) => (
              <div key={conv.id} style={{ background: "#1a1a1a", border: "0.5px solid #2a2a2a", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Icon name="chat" size={13} color="#6C63FF" />
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conv.title}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: "#555" }}>{conv.messages.length} messages · {conv.createdAt}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => { dispatch({ type: "SET_CONV", id: conv.id }); dispatch({ type: "SET_VIEW", view: "chat" }); }}
                      style={{ padding: "5px 10px", borderRadius: 7, border: "0.5px solid #333", background: "transparent", cursor: "pointer", fontSize: 12, color: "#888" }}>Open</button>
                    <button onClick={() => dispatch({ type: "DELETE_CONV", id: conv.id })}
                      style={{ padding: "5px 8px", borderRadius: 7, border: "0.5px solid #2a2a2a", background: "transparent", cursor: "pointer", color: "#555" }}>
                      <Icon name="trash" size={13} color="#555" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
      {state.notes.length > 0 && (
        <>
          <h3 style={{ margin: "22px 0 10px", fontSize: 13, fontWeight: 500, color: "#555" }}>Saved notes ({state.notes.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {state.notes.map((note) => (
              <div key={note.id} style={{ background: "#1a1a1a", border: "0.5px solid #2a2a2a", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="note" size={13} color="#4ECDC4" />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#ddd" }}>{note.title}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "#555" }}>{note.createdAt}</span>
                    <button onClick={() => dispatch({ type: "DELETE_NOTE", id: note.id })} style={{ padding: "4px 6px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer" }}>
                      <Icon name="trash" size={12} color="#555" />
                    </button>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#666", whiteSpace: "pre-wrap", maxHeight: 80, overflow: "hidden" }}>{note.content.slice(0, 200)}{note.content.length > 200 ? "…" : ""}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const SettingsView = ({ isMobile }) => (
  <div style={{ padding: isMobile ? "16px 12px" : "24px", overflowY: "auto", height: "100%", background: "#111" }}>
    <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 18 : 20, fontWeight: 600, color: "#fff" }}>Settings</h2>
    <p style={{ margin: "0 0 24px", fontSize: 13, color: "#666" }}>Configure your Chat AI workspace</p>
    {[
      { section: "AI Configuration", items: [{ label: "Model", desc: "claude-sonnet-4-20250514", badge: "Active" }, { label: "Max tokens", desc: "1,000 per response" }, { label: "API", desc: "Connected via Anthropic API" }] },
      { section: "Interface", items: [{ label: "Theme", desc: "Full black dark mode" }, { label: "Layout", desc: "Responsive — sidebar on desktop, bottom nav on mobile" }, { label: "Auto-scroll", desc: "Enabled in chat view" }] },
      { section: "Data", items: [{ label: "Conversation history", desc: "Stored in session memory" }, { label: "Notes", desc: "Saved locally during session" }, { label: "Privacy", desc: "No data is persisted between reloads" }] },
    ].map((group) => (
      <div key={group.section} style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 500, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em" }}>{group.section}</h3>
        <div style={{ background: "#1a1a1a", border: "0.5px solid #2a2a2a", borderRadius: 12, overflow: "hidden" }}>
          {group.items.map((item, i) => (
            <div key={item.label} style={{ padding: "14px 16px", borderBottom: i < group.items.length - 1 ? "0.5px solid #222" : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#ddd" }}>{item.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#555" }}>{item.desc}</p>
              </div>
              {item.badge && <span style={{ padding: "3px 8px", borderRadius: 6, background: "#4ECDC420", color: "#4ECDC4", fontSize: 11, fontWeight: 500 }}>{item.badge}</span>}
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const isMobile = useIsMobile();
  useEffect(() => { dispatch({ type: "NEW_CONV" }); }, []);
  const viewProps = { state, dispatch, isMobile };
  const views = {
    chat: <ChatView {...viewProps} />,
    tools: <ToolsView {...viewProps} />,
    dashboard: <DashboardView {...viewProps} />,
    history: <HistoryView {...viewProps} />,
    settings: <SettingsView {...viewProps} />,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "#000", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {isMobile && (
        <header style={{ padding: "0 16px", height: 50, borderBottom: "0.5px solid #222", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "#000" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#6C63FF,#4ECDC4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>C</span>
            </div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#fff" }}>Chat AI</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ECDC4" }} />
            <span style={{ fontSize: 11, color: "#555" }}>AI ready</span>
          </div>
        </header>
      )}
      {!isMobile && (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Sidebar state={state} dispatch={dispatch} />
          <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#111" }}>
            <header style={{ padding: "0 20px", height: 50, borderBottom: "0.5px solid #222", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "#0a0a0a" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#fff", textTransform: "capitalize" }}>{state.currentView}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ECDC4" }} />
                <span style={{ fontSize: 12, color: "#555" }}>AI ready</span>
              </div>
            </header>
            <div style={{ flex: 1, overflow: "hidden" }}>{views[state.currentView]}</div>
          </main>
        </div>
      )}
      {isMobile && (
        <>
          <div style={{ flex: 1, overflow: "hidden" }}>{views[state.currentView]}</div>
          <MobileNav state={state} dispatch={dispatch} />
        </>
      )}
    </div>
  );
}
