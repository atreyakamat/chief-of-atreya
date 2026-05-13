import sys
import openwakeword
from openwakeword.model import Model
import numpy as np

# Load the wake word model for "Hey Zen" 
# NOTE: This assumes you have trained a custom model or are using a compatible one
# For this scaffold, we load the default models. 
model = Model(wakeword_models=['alexa'])

print("Zen wake word detector initialized", flush=True)

try:
    while True:
        # Read 1280 samples (80ms of 16kHz audio)
        raw_audio = sys.stdin.buffer.read(2560)
        if not raw_audio:
            break
        
        audio_data = np.frombuffer(raw_audio, dtype=np.int16)
        
        # Predict
        predictions = model.predict(audio_data)
        
        # Check if the trigger word probability exceeds threshold
        for m in predictions:
            if predictions[m] > 0.5:
                print(f"DETECTED:{m}", flush=True)
except KeyboardInterrupt:
    pass
