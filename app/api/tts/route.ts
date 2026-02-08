import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return new NextResponse("Missing ELEVENLABS_API_KEY", { status: 500 });

  const { text, voiceId } = await req.json();

  if (!text || typeof text !== "string") return new NextResponse("Missing text", { status: 400 });
  if (!voiceId || typeof voiceId !== "string") return new NextResponse("Missing voiceId", { status: 400 });

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      output_format: "mp3_44100_128",
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    return new NextResponse(t, { status: r.status });
  }

  const audio = await r.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
