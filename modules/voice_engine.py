#!/usr/bin/env python3
import sys
import json
import time
import threading
import subprocess
import os
import tempfile
import wave
import shutil

HAS_PYTTSX3 = False
try:
    import pyttsx3
    HAS_PYTTSX3 = True
except ImportError:
    pass

HAS_WHISPER = False
WHISPER_MODEL = None

try:
    import whisper
    HAS_WHISPER = True
except ImportError:
    pass

try:
    from faster_whisper import WhisperModel
    HAS_FASTER_WHISPER = True
except ImportError:
    HAS_FASTER_WHISPER = False

CHUNK = 1024
FORMAT = 8
CHANNELS = 1
RATE = 16000
RECORD_SECONDS = 5
WAKE_WORDS = ["hey chief", "okay chief"]

class VoiceEngine:
    def __init__(self):
        self.tts_engine = None
        self.audio = None
        self.stream = None
        self.running = True
        self.frames = []
        self.whisper_loaded = False

        if HAS_PYTTSX3:
            try:
                self.tts_engine = pyttsx3.init()
                self.tts_engine.setProperty('rate', 150)
                self.tts_engine.setProperty('volume', 1.0)
            except Exception as e:
                print(json.dumps({"event": "error", "error": f"TTS init failed: {e}"}), flush=True)

        if HAS_WHISPER:
            try:
                self.whisper_model = whisper.load_model("base")
                self.whisper_loaded = True
                print(json.dumps({"event": "status", "message": "Whisper model loaded"}), flush=True)
            except Exception as e:
                print(json.dumps({"event": "error", "error": f"Whisper load failed: {e}"}), flush=True)
        elif HAS_FASTER_WHISPER:
            try:
                self.whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
                self.whisper_loaded = True
                print(json.dumps({"event": "status", "message": "Faster-Whisper model loaded"}), flush=True)
            except Exception as e:
                print(json.dumps({"event": "error", "error": f"Faster-Whisper load failed: {e}"}), flush=True)

        try:
            import pyaudio
            self.audio = pyaudio.PyAudio()
        except ImportError:
            self.audio = None
            msg = "pyaudio not available. On Windows, try: pip install pipwin && pipwin install pyaudio"
            print(json.dumps({"event": "error", "error": msg}), flush=True)

    def speak(self, text):
        try:
            if self.tts_engine:
                def _speak():
                    try:
                        self.tts_engine.say(text)
                        self.tts_engine.runAndWait()
                    except Exception as e:
                        pass
                threading.Thread(target=_speak, daemon=True).start()
                self.send_msg({"event": "speak_started"})
            else:
                try:
                    result = subprocess.run(
                        ["espeak-ng", "-s", "150", "-a", "150", text],
                        capture_output=True, timeout=30
                    )
                except FileNotFoundError:
                    try:
                        subprocess.run(["say", text], timeout=30)
                    except:
                        pass
        except Exception as e:
            self.send_msg({"event": "error", "error": f"Speak error: {e}"})

    def transcribe(self, audio_file_path):
        if not self.whisper_loaded:
            return None
        try:
            if HAS_WHISPER:
                result = self.whisper_model.transcribe(audio_file_path, language="en")
                return result["text"].strip()
            elif HAS_FASTER_WHISPER:
                segments, info = self.whisper_model.transcribe(audio_file_path, language="en")
                return " ".join([s.text for s in segments]).strip()
        except Exception as e:
            self.send_msg({"event": "error", "error": f"Transcription failed: {e}"})
        return None

    def record_audio(self):
        if not self.audio:
            return None
        
        frames = []
        try:
            stream = self.audio.open(
                format=FORMAT,
                channels=CHANNELS,
                rate=RATE,
                input=True,
                frames_per_buffer=CHUNK
            )
            
            for _ in range(0, int(RATE / CHUNK * RECORD_SECONDS)):
                if not self.running:
                    break
                try:
                    data = stream.read(CHUNK, exception_on_overflow=False)
                    frames.append(data)
                except:
                    break
            
            stream.stop_stream()
            stream.close()
            
            if frames:
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
                wf = wave.open(tmp.name, 'wb')
                wf.setnchannels(CHANNELS)
                wf.setsampwidth(self.audio.get_sample_size(FORMAT))
                wf.setframerate(RATE)
                wf.writeframes(b''.join(frames))
                wf.close()
                return tmp.name
        except Exception as e:
            self.send_msg({"event": "error", "error": f"Recording error: {e}"})
        return None

    def send_msg(self, msg):
        print(json.dumps(msg), flush=True)

    def listen_loop(self):
        if not self.audio or not self.whisper_loaded:
            self.send_msg({"event": "status", "message": "Voice listening unavailable"})
            return

        self.send_msg({"event": "status", "message": "Listening for 'Hey Chief' wake word..."})

        try:
            stream = self.audio.open(
                format=FORMAT,
                channels=CHANNELS,
                rate=RATE,
                input=True,
                frames_per_buffer=CHUNK
            )

            buffer = []
            buffer_size = int(RATE / CHUNK * 3)
            silence_threshold = 500
            silence_count = 0
            listening_for_command = False

            while self.running:
                try:
                    data = stream.read(CHUNK, exception_on_overflow=False)
                    buffer.append(data)
                    if len(buffer) > buffer_size:
                        buffer.pop(0)

                    if not listening_for_command:
                        try:
                            import numpy as np
                            audio_np = np.frombuffer(data, dtype=np.int16)
                            volume = np.abs(audio_np).mean()
                            
                            if volume > silence_threshold:
                                recent = b''.join(buffer[-20:]).decode('utf-8', errors='ignore').lower()
                                if any(w in recent for w in WAKE_WORDS):
                                    self.send_msg({"event": "wake_word_detected"})
                                    listening_for_command = True
                                    silence_count = 0
                                    time.sleep(0.3)
                        except ImportError:
                            pass
                    else:
                        try:
                            import numpy as np
                            audio_np = np.frombuffer(data, dtype=np.int16)
                            volume = np.abs(audio_np).mean()
                            
                            if volume < 50:
                                silence_count += 1
                                if silence_count > 20:
                                    listening_for_command = False
                                    audio_file = self.record_audio()
                                    if audio_file:
                                        text = self.transcribe(audio_file)
                                        os.unlink(audio_file)
                                        if text and len(text.strip()) > 0:
                                            self.send_msg({"event": "transcription", "text": text})
                            else:
                                silence_count = 0
                        except ImportError:
                            pass

                except Exception as e:
                    if self.running:
                        continue

            stream.stop_stream()
            stream.close()

        except Exception as e:
            self.send_msg({"event": "error", "error": f"Listen loop error: {e}"})

    def handle_input(self):
        for line in sys.stdin:
            try:
                data = json.loads(line)
                cmd = data.get("command")
                
                if cmd == "speak":
                    threading.Thread(target=self.speak, args=(data.get("text", ""),), daemon=True).start()
                elif cmd == "record":
                    audio_file = self.record_audio()
                    if audio_file:
                        text = self.transcribe(audio_file)
                        os.unlink(audio_file)
                        if text:
                            self.send_msg({"event": "transcription", "text": text})
                elif cmd == "stop":
                    self.running = False
                    break
            except json.JSONDecodeError:
                pass
            except Exception as e:
                self.send_msg({"event": "error", "error": str(e)})

if __name__ == "__main__":
    engine = VoiceEngine()
    engine.send_msg({
        "event": "ready",
        "has_whisper": HAS_WHISPER or HAS_FASTER_WHISPER,
        "has_faster_whisper": HAS_FASTER_WHISPER,
        "has_pyttsx3": HAS_PYTTSX3,
        "wake_words": WAKE_WORDS
    })

    if engine.whisper_loaded:
        listen_thread = threading.Thread(target=engine.listen_loop, daemon=True)
        listen_thread.start()

    engine.handle_input()
