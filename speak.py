import os
import time
import serial
from elevenlabs import ElevenLabs
from elevenlabs import play as el_play  

PORT = "COM6"
BAUD = 115200
VOICE_ID = "FGY2WhTYpPnrIDTdsKH5"
MODEL_ID = "eleven_multilingual_v2"
OUTPUT_FORMAT = "mp3_44100_128"

API_KEY = os.getenv("ELEVENLABS_API_KEY")
if not API_KEY:
    raise RuntimeError("Cant find api key")

client = ElevenLabs(api_key=API_KEY)

def stream_tts(text: str):
    audio_stream = client.text_to_speech.stream(
        voice_id=VOICE_ID,
        output_format=OUTPUT_FORMAT,
        text=text,
        model_id=MODEL_ID,
    )
    el_play.play(audio_stream)  

def main():
    ser = serial.Serial(PORT, BAUD, timeout=1)
    time.sleep(2)

    word = ""
    last = ""
    last_time = 0
    COOLDOWN = 0.25

    print("Listening")

    while True:
        line = ser.readline().decode(errors="ignore").strip()
        if not line:
            continue

        now = time.time()
        if line == last and (now - last_time) < COOLDOWN:
            continue
        last, last_time = line, now

        msg = line.upper()

        if msg == "SPACE":
            if word:
                print("SPEAK:", word)
                stream_tts(word)
                word = ""
            continue

        if len(msg) == 1 and msg.isalpha():
            word += msg
            print("WORD:", word)

if __name__ == "__main__":
    main()




