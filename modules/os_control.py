import sys
import json
import pyautogui
import os
import subprocess

def execute_command(cmd):
    try:
        action = cmd.get("action")
        if action == "click":
            x = cmd.get("x")
            y = cmd.get("y")
            if x is not None and y is not None:
                pyautogui.click(x, y)
            else:
                pyautogui.click()
            return {"status": "success", "message": f"Clicked at {x},{y}"}
        
        elif action == "type":
            text = cmd.get("text")
            pyautogui.write(text, interval=0.01)
            if cmd.get("enter"):
                pyautogui.press('enter')
            return {"status": "success", "message": f"Typed text"}
            
        elif action == "key":
            key = cmd.get("key")
            pyautogui.press(key)
            return {"status": "success", "message": f"Pressed {key}"}
            
        elif action == "open":
            app = cmd.get("app")
            # Basic windows app opener
            os.system(f"start {app}")
            return {"status": "success", "message": f"Opened {app}"}
            
        else:
            return {"status": "error", "message": "Unknown action"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Read single line JSON commands from stdin
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        command = json.loads(line)
        result = execute_command(command)
        print(json.dumps(result), flush=True)
    except json.JSONDecodeError:
        print(json.dumps({"status": "error", "message": "Invalid JSON"}), flush=True)
