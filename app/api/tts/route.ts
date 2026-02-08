import { NextResponse } from "next/server";

export const runtime = "nodejs";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return new NextResponse("Missing ELEVENLABS_API_KEY", { status: 500 });

  const body = await req.json().catch(() => null);
  if (!body) return new NextResponse("Invalid JSON", { status: 400 });

  const text = body.text;
  const voiceId = body.voiceId;
  const voice_settings = body.voice_settings ?? {};
  const speed = typeof body.speed === "number" ? body.speed : undefined;

  if (!text || typeof text !== "string") return new NextResponse("Missing text", { status: 400 });
  if (!voiceId || typeof voiceId !== "string") return new NextResponse("Missing voiceId", { status: 400 });

  const vs: any = {
    stability:
      typeof voice_settings.stability === "number"
        ? clamp(voice_settings.stability, 0, 1)
        : 0.5,
    similarity_boost:
      typeof voice_settings.similarity_boost === "number"
        ? clamp(voice_settings.similarity_boost, 0, 1)
        : 0.75,
    style:
      typeof voice_settings.style === "number"
        ? clamp(voice_settings.style, 0, 1)
        : 0.2,
    use_speaker_boost: voice_settings.use_speaker_boost !== false,
  };

  if (typeof speed === "number") {
    vs.speed = clamp(speed, 0.5, 1.5);
  }

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      output_format: "mp3_44100_128",
      voice_settings: vs,
    }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return new NextResponse(t || `ElevenLabs error ${r.status}`, { status: r.status });
  }

  const audio = await r.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

