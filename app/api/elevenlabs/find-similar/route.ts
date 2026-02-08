import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return new NextResponse("Missing ELEVENLABS_API_KEY", { status: 500 });

  const form = await req.formData();
  const file = form.get("audio_file");

  const out = new FormData();
  if (file instanceof Blob) out.append("audio_file", file, "sample.webm");

  const r = await fetch("https://api.elevenlabs.io/v1/similar-voices", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: out,
  });

  const text = await r.text();
  if (!r.ok) return new NextResponse(text, { status: r.status });
  return NextResponse.json(JSON.parse(text));
}
