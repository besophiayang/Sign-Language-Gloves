"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/bclient";
import { useRouter } from "next/navigation";

type SimilarVoice = {
  voice_id?: string;
  name?: string;
  description?: string;
  preview_url?: string;
};

type GloveMsg =
  | { type: "status"; ok: boolean; message: string }
  | { type: "glove"; text: string };

export default function DashboardPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [voices, setVoices] = useState<SimilarVoice[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [gloveConnected, setGloveConnected] = useState(false);
  const [gloveStatus, setGloveStatus] = useState("");
  const [lastGlove, setLastGlove] = useState("");
  const [word, setWord] = useState("");
  const [speaking, setSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const wordRef = useRef("");
  const selectedVoiceRef = useRef("");

  useEffect(() => {
    wordRef.current = word;
  }, [word]);

  useEffect(() => {
    selectedVoiceRef.current = selectedVoiceId;
  }, [selectedVoiceId]);

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
      if (!selectedVoiceRef.current && list[0]?.voice_id) setSelectedVoiceId(list[0].voice_id);
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
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setGloveStatus("Connecting to glove bridge...");
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
      setGloveStatus("WebSocket error (is glove-bridge running?)");
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
        setGloveStatus(data.message);
        return;
      }

      if (data.type !== "glove") return;

      const msg = String(data.text || "").trim().toUpperCase();
      if (!msg) return;

      setLastGlove(msg);

      if (msg === "BACK") {
        setWord((prev) => prev.slice(0, -1));
        return;
      }

      if (msg === "SPACE") {
        const w = wordRef.current.trim();
        const vId = selectedVoiceRef.current.trim();
        if (!w || !vId || speaking) {
          setWord("");
          return;
        }
        setWord("");
        await speak(w, vId);
        return;
      }

      if (msg.startsWith("PHRASE:")) {
        const phrase = msg.slice("PHRASE:".length).trim();
        setWord(phrase);
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
        setGloveStatus(`TTS error: ${t || res.status}`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await audio.play();
      audio.onended = () => URL.revokeObjectURL(url);
    } catch (e: any) {
      setGloveStatus(`TTS error: ${e.message ?? String(e)}`);
    } finally {
      setSpeaking(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Find Similar ElevenLabs Voices</h1>
        <button onClick={signOut}>Sign out</button>
      </div>

      <div style={{ display: "grid", gap: 10, border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {!gloveConnected ? (
            <button onClick={connectGlove}>Connect glove</button>
          ) : (
            <button onClick={disconnectGlove}>Disconnect glove</button>
          )}
          <div><b>Status:</b> {gloveStatus}</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div><b>Last:</b> {lastGlove}</div>
          <div><b>Word:</b> {word}</div>
        </div>
        <div>
          <b>Selected voice:</b>{" "}
          {selectedVoiceId ? selectedVoiceId : "None (record and pick one)"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        {!recording ? (
          <button onClick={start}>Start recording</button>
        ) : (
          <button onClick={stop}>Stop + find similar voices</button>
        )}
        <div>{status}</div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {voices.map((v, i) => {
          const isSelected = !!v.voice_id && v.voice_id === selectedVoiceId;
          return (
            <div
              key={i}
              style={{
                border: isSelected ? "2px solid #111" : "1px solid #ddd",
                padding: 12,
                borderRadius: 10,
                cursor: v.voice_id ? "pointer" : "default",
              }}
              onClick={() => v.voice_id && setSelectedVoiceId(v.voice_id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div><b>{v.name ?? "Unnamed"}</b></div>
                  <div style={{ opacity: 0.8 }}>{v.voice_id}</div>
                </div>
                {isSelected && <div><b>Selected</b></div>}
              </div>
              {v.description && <div style={{ marginTop: 6 }}>{v.description}</div>}
              {v.preview_url && (
                <audio
                  controls
                  src={v.preview_url}
                  style={{ marginTop: 10, width: "100%" }}
                  onPlay={() => {
                    if (v.voice_id) setSelectedVoiceId(v.voice_id);
                  }}
                />
              )}
              {v.voice_id && (
                <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVoiceId(v.voice_id!);
                      speak("Hello! This is a voice preview.", v.voice_id!);
                    }}
                    disabled={speaking}
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
  );
}


