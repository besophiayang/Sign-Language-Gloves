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

export default function DashboardPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [voices, setVoices] = useState<SimilarVoice[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

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
      setVoices(json.voices ?? json.similar_voices ?? []);
      setStatus("Done");
    } catch (e: any) {
      setStatus(`Error: ${e.message ?? String(e)}`);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Find Similar ElevenLabs Voices</h1>
        <button onClick={signOut}>Sign out</button>
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
        {voices.map((v, i) => (
          <div key={i} style={{ border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
            <div><b>{v.name ?? "Unnamed"}</b></div>
            <div style={{ opacity: 0.8 }}>{v.voice_id}</div>
            {v.description && <div style={{ marginTop: 6 }}>{v.description}</div>}
            {v.preview_url && <audio controls src={v.preview_url} style={{ marginTop: 10, width: "100%" }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

