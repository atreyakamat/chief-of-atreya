import speech_recognition as sr
import sys
import time

def listen_for_zen():
    r = sr.Recognizer()
    mic = sr.Microphone()
    
    print("Zen wake word detector initialized (Mode: STT Fallback)", flush=True)
    
    while True:
        with mic as source:
            r.adjust_for_ambient_noise(source, duration=0.5)
            try:
                # Listen in short chunks for responsiveness
                audio = r.listen(source, timeout=5, phrase_time_limit=2)
                
                # Use Google STT (free, reliable for single words)
                text = r.recognize_google(audio).lower()
                
                if "zen" in text or "xen" in text or "hey zen" in text:
                    print("DETECTED:alexa", flush=True) # Mapping to existing alexa handler
                    
            except sr.WaitTimeoutError:
                continue
            except sr.UnknownValueError:
                continue
            except Exception as e:
                print(f"DEBUG: {str(e)}", flush=True)
                time.sleep(1)

if __name__ == "__main__":
    try:
        listen_for_zen()
    except KeyboardInterrupt:
        pass
