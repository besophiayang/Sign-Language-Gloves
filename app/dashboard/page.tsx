"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/bclient";
import { useRouter } from "next/navigation";

type SimilarVoice = {
  voice_id?: string;
  name?: string;
  description?: string;
  preview_url?: string;
  gender?: string;
  accent?: string;
  age?: string;
  descriptive?: string;
  use_case?: string;
  category?: string;
  language?: string;
};

type GloveMsg =
  | { type: "status"; ok: boolean; message: string }
  | { type: "glove"; text: string };

function toNiceWords(s?: string) {
  if (!s) return "";
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortVoiceTag(v: SimilarVoice) {
  const parts: string[] = [];

  const descriptive = toNiceWords(v.descriptive);
  const useCase = toNiceWords(v.use_case);
  const accent = toNiceWords(v.accent);

  if (descriptive) parts.push(descriptive);
  if (useCase) parts.push(useCase.replace("characters animation", "character voice"));
  if (accent) parts.push(accent);

  const tag = parts.join(" · ").trim();
  if (tag) return tag.slice(0, 64);

  const d = (v.description || "").trim();
  if (!d) return "";
  const first = d.split(/[.!?\n]/)[0].trim();
  return first.length > 70 ? first.slice(0, 67) + "..." : first;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [voices, setVoices] = useState<SimilarVoice[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");

  const [gloveConnected, setGloveConnected] = useState(false);
  const [gloveStatus, setGloveStatus] = useState("");
  const [lastGlove, setLastGlove] = useState("");
  const [word, setWord] = useState("");
  const [speaking, setSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const wordRef = useRef("");
  const selectedVoiceIdRef = useRef("");
  const selectedVoiceNameRef = useRef("");
  const speakingRef = useRef(false);

  useEffect(() => {
    wordRef.current = word;
  }, [word]);

  useEffect(() => {
    selectedVoiceIdRef.current = selectedVoiceId;
  }, [selectedVoiceId]);

  useEffect(() => {
    selectedVoiceNameRef.current = selectedVoiceName;
  }, [selectedVoiceName]);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.push("/login");
    })();
  }, [router, supabase]);

  async function start() {
    setStatus("");
    setVoices([]);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    chunksRef.current = [];
    mr.ondataavailable = (e) => chunksRef.current.push(e.data);
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      await findSimilar(blob);
      stream.getTracks().forEach((t) => t.stop());
    };
    mediaRecorderRef.current = mr;
    mr.start();
    setRecording(true);
    setStatus("Recording...");
  }

  async function stop() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setStatus("Uploading...");
  }

  async function findSimilar(audioBlob: Blob) {
    try {
      const fd = new FormData();
      fd.append("audio_file", audioBlob, "sample.webm");

      const res = await fetch("/api/elevenlabs/find-similar", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const json = await res.json();
      const list: SimilarVoice[] = json.voices ?? json.similar_voices ?? [];
      setVoices(list);

      if (!selectedVoiceIdRef.current && list[0]?.voice_id) {
        setSelectedVoiceId(list[0].voice_id || "");
        setSelectedVoiceName(list[0].name || "Selected voice");
      }

      setStatus("Done");
    } catch (e: any) {
      setStatus(`Error: ${e.message ?? String(e)}`);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function connectGlove() {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setGloveStatus("Connecting...");
    const ws = new WebSocket("ws://localhost:8787");
    wsRef.current = ws;

    ws.onopen = () => {
      setGloveConnected(true);
      setGloveStatus("Connected");
    };

    ws.onclose = () => {
      setGloveConnected(false);
      setGloveStatus("Disconnected");
      wsRef.current = null;
    };

    ws.onerror = () => {
      setGloveConnected(false);
      setGloveStatus("Bridge error (is glove-bridge running?)");
    };

    ws.onmessage = async (ev) => {
      let data: GloveMsg | null = null;
      try {
        data = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (!data) return;

      if (data.type === "status") {
        const m = String(data.message || "");
        if (m.includes("connected_to_bridge")) setGloveStatus("Connected");
        else if (m.includes("serial_open")) setGloveStatus("Connected");
        else setGloveStatus(m);
        return;
      }

      if (data.type !== "glove") return;

      const msg = String(data.text || "").trim().toUpperCase();
      if (!msg) return;

      setLastGlove(msg);

      if (msg.startsWith("PHRASE:")) {
        const phrase = msg.slice("PHRASE:".length).trim();
        setWord(phrase);
        return;
      }

      if (msg === "BACK") {
        setWord((prev) => prev.slice(0, -1));
        return;
      }

      if (msg === "SPACE") {
        const w = wordRef.current.trim();
        const vId = selectedVoiceIdRef.current.trim();
        if (!w || !vId || speakingRef.current) {
          setWord("");
          return;
        }
        setWord("");
        await speak(w, vId);
        return;
      }

      if (msg.length === 1 && msg >= "A" && msg <= "Z") {
        setWord((prev) => prev + msg);
      }
    };
  }

  function disconnectGlove() {
    wsRef.current?.close();
    wsRef.current = null;
    setGloveConnected(false);
    setGloveStatus("Disconnected");
  }

  async function speak(text: string, voiceId: string) {
    try {
      setSpeaking(true);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId }),
      });

      if (!res.ok) {
        const t = await res.text();
        setGloveStatus(`TTS error`);
        setStatus(t || `HTTP ${res.status}`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await audio.play();
      audio.onended = () => URL.revokeObjectURL(url);
    } catch (e: any) {
      setGloveStatus(`TTS error`);
      setStatus(e?.message ?? String(e));
    } finally {
      setSpeaking(false);
    }
  }

  const selectedDisplay = useMemo(() => {
    if (selectedVoiceName) return selectedVoiceName;
    const v = voices.find((x) => x.voice_id === selectedVoiceId);
    return v?.name || "";
  }, [selectedVoiceId, selectedVoiceName, voices]);

  const cardStyle: React.CSSProperties = {
    width: "min(920px, 92vw)",
    borderRadius: 28,
    padding: 22,
    background: "rgba(255,255,255,0.10)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
  };

  const buttonStyle: React.CSSProperties = {
    border: "none",
    borderRadius: 14,
    padding: "12px 14px",
    color: "rgba(255,255,255,0.92)",
    background: "linear-gradient(90deg, rgba(110,90,255,0.70), rgba(255,64,140,0.55))",
    boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
    cursor: "pointer",
    fontWeight: 800,
    letterSpacing: 0.6,
  };

  const ghostButtonStyle: React.CSSProperties = {
    borderRadius: 14,
    padding: "12px 14px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 800,
  };

  const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.20)",
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.70)",
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 900,
    color: "rgba(255,255,255,0.92)",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px 0",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(900px 600px at 25% 15%, rgba(255,70,140,0.35), transparent 60%), radial-gradient(800px 520px at 70% 35%, rgba(120,80,255,0.35), transparent 55%), linear-gradient(135deg, #14102a, #0b0a14 55%, #101c34)",
      }}
    >
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(255,255,255,0.65)" }}>
              SignGloves
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "rgba(255,255,255,0.92)", marginTop: 4 }}>
              Voice Matching
            </div>
          </div>
          <button onClick={signOut} style={ghostButtonStyle}>
            Sign out
          </button>
        </div>

        <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <div
            style={{
              borderRadius: 20,
              padding: 16,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.22)",
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              {!gloveConnected ? (
                <button onClick={connectGlove} style={buttonStyle}>
                  Connect glove
                </button>
              ) : (
                <button onClick={disconnectGlove} style={ghostButtonStyle}>
                  Disconnect
                </button>
              )}

              <div style={chipStyle}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: gloveConnected ? "rgba(70,255,170,0.85)" : "rgba(255,120,120,0.85)" }} />
                <span>{gloveStatus || "—"}</span>
              </div>

              <div style={chipStyle}>
                <span style={{ opacity: 0.75 }}>Selected voice:</span>
                <span style={{ fontWeight: 900 }}>{selectedDisplay || "None"}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ borderRadius: 16, padding: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
                <div style={labelStyle}>Last</div>
                <div style={valueStyle}>{lastGlove || "—"}</div>
              </div>
              <div style={{ borderRadius: 16, padding: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
                <div style={labelStyle}>Word</div>
                <div style={valueStyle}>{word || "—"}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ color: "rgba(255,255,255,0.75)" }}>{status || ""}</div>
              {!recording ? (
                <button onClick={start} style={buttonStyle}>
                  Start recording
                </button>
              ) : (
                <button onClick={stop} style={buttonStyle}>
                  Stop + find voices
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {voices.map((v, i) => {
              const isSelected = !!v.voice_id && v.voice_id === selectedVoiceId;
              const sub = shortVoiceTag(v);
              return (
                <div
                  key={i}
                  style={{
                    borderRadius: 20,
                    padding: 16,
                    border: isSelected ? "2px solid rgba(255,255,255,0.55)" : "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(0,0,0,0.18)",
                    cursor: v.voice_id ? "pointer" : "default",
                  }}
                  onClick={() => {
                    if (!v.voice_id) return;
                    setSelectedVoiceId(v.voice_id);
                    setSelectedVoiceName(v.name || "Selected voice");
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
                        {v.name ?? "Unnamed"}
                      </div>
                      {sub && (
                        <div style={{ color: "rgba(255,255,255,0.70)", fontSize: 13, marginTop: 6 }}>
                          {sub}
                        </div>
                      )}
                    </div>
                    {isSelected && <div style={{ ...chipStyle, background: "rgba(255,255,255,0.10)" }}>Selected</div>}
                  </div>

                  {v.preview_url && (
                    <div style={{ marginTop: 12 }}>
                      <audio
                        controls
                        src={v.preview_url}
                        style={{ width: "100%", filter: "invert(0.92) hue-rotate(190deg) saturate(1.2)" }}
                        onPlay={() => {
                          if (!v.voice_id) return;
                          setSelectedVoiceId(v.voice_id);
                          setSelectedVoiceName(v.name || "Selected voice");
                        }}
                      />
                    </div>
                  )}

                  {v.voice_id && (
                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVoiceId(v.voice_id!);
                          setSelectedVoiceName(v.name || "Selected voice");
                          speak("Hello! This is a voice preview.", v.voice_id!);
                        }}
                        disabled={speaking}
                        style={ghostButtonStyle}
                      >
                        Speak preview
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}




