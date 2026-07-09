#!/usr/bin/env python3
"""Generate an image asset with Gemini. Usage: gen.py "<prompt>" <out.png> [model]"""
import os, sys
from google import genai

prompt, out = sys.argv[1], sys.argv[2]
model = sys.argv[3] if len(sys.argv) > 3 else "gemini-3-pro-image-preview"
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
resp = client.models.generate_content(model=model, contents=prompt)
saved = False
for part in resp.candidates[0].content.parts:
    if getattr(part, "inline_data", None) and part.inline_data.data:
        with open(out, "wb") as f:
            f.write(part.inline_data.data)
        print(f"SAVED {out} ({len(part.inline_data.data)} bytes) via {model}")
        saved = True
        break
if not saved:
    txt = getattr(resp, "text", None) or "(no text)"
    print("NO IMAGE. model said:", txt[:400])
