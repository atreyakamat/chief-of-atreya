import sys
import json
import time
import threading
import subprocess
import traceback

# ─── TTS: Try pyttsx3 first, fall back to espeak-ng (available on Arch) ───
try:
    import pyttsx3
    HAS_PYTTSX3 = True
except ImportError:
    HAS_PYTTSX3 = False

# ─── STT & Wake Word ───
try:
    import whisper
    import pyaudio
    import numpy as np
    HAS_WHISPER = True
except ImportError:
    HAS_WHISPER = False

try:
    from openwakeword.model import Model
    HAS_WAKEWORD = True
except ImportError:
    HAS_WAKEWORD = False

CHUNK = 1280
FORMAT = 8  # pyaudio.paInt16
CHANNELS = 1
RATE = 16000

class VoiceEngine:
    def __init__(self):
        self.tts_engine = None
        self.is_listening = False
        self.running = True

        if HAS_PYTTSX3:
            try:
                self.tts_engine = pyttsx3.init()
            except Exception:
                pass

        if HAS_WHISPER:
            try:
                self.audio = pyaudio.PyAudio()
            except Exception:
                self.audio = None
        else:
            self.audio = None

    def speak(self, text):
        try:
            if self.tts_engine:
                self.tts_engine.say(text)
                self.tts_engine.runAndWait()
                self.send_msg({"event": "speak_done", "success": True})
            else:
                # Fallback: espeak-ng (available on Arch/Omarchy via pacman)
                result = subprocess.run(
                    ["espeak-ng", text],
                    capture_output=True, timeout=30
                )
                self.send_msg({"event": "speak_done", "success": result.returncode == 0})
        except FileNotFoundError:
            self.send_msg({"event": "error", "error": "No TTS engine available. Install pyttsx3 or espeak-ng."})
        except Exception as e:
            self.send_msg({"event": "error", "error": f"TTS failed: {e}"})

    def transcribe(self, audio_data):
        """Transcribe audio using Whisper (runs locally)."""
        if not HAS_WHISPER:
            return None
        try:
            model = whisper.load_model("base")
            result = model.transcribe(audio_data)
            return result.get("text", "")
        except Exception as e:
            self.send_msg({"event": "error", "error": f"Transcription failed: {e}"})
            return None

    def send_msg(self, msg):
        print(json.dumps(msg), flush=True)

    def listen_loop(self):
        if not self.audio:
            self.send_msg({"event": "status", "message": "Voice listening unavailable (missing pyaudio/portaudio)"})
            return

        try:
            self.send_msg({"event": "status", "message": "Voice Engine Ready — awaiting wake word or push-to-talk"})

            # In a full implementation:
            # 1. Open mic stream via pyaudio
            # 2. Feed chunks to openwakeword Model
            # 3. On detection → record N seconds → transcribe with Whisper
            # 4. Send transcription back to Node.js via stdout

            while self.running:
                time.sleep(1)

        except Exception as e:
            self.send_msg({"event": "error", "error": f"Listening loop error: {e}"})

    def handle_input(self):
        for line in sys.stdin:
            try:
                data = json.loads(line)
                cmd = data.get("command")
                if cmd == "speak":
                    threading.Thread(target=self.speak, args=(data.get("text", ""),), daemon=True).start()
                elif cmd == "stop":
                    self.running = False
                    break
            except Exception as e:
                self.send_msg({"event": "error", "error": str(e)})

if __name__ == "__main__":
    engine = VoiceEngine()
    engine.send_msg({
        "event": "ready",
        "has_whisper": HAS_WHISPER,
        "has_pyttsx3": HAS_PYTTSX3,
        "has_wakeword": HAS_WAKEWORD
    })

    listen_thread = threading.Thread(target=engine.listen_loop, daemon=True)
    listen_thread.start()

    engine.handle_input()
