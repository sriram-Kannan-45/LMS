import os
import time
import logging
import requests
from typing import Dict, Any, Optional

log = logging.getLogger("ai-quiz.gemini-client")

class GeminiClient:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        
        # Use v1beta endpoint for flash/pro models as it is highly compatible with JSON mode
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    def generate_content(self, prompt: str, temperature: float = 0.2, response_json: bool = True) -> str:
        """
        Call the Gemini REST API directly using requests.
        Implements linear backoff and retries for rate limits (429 RESOURCE_EXHAUSTED).
        """
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured. Please check your environment variables.")

        url = f"{self.base_url}/{self.model}:generateContent?key={self.api_key}"
        headers = {'Content-Type': 'application/json'}
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature
            }
        }
        
        if response_json:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        max_retries = 3
        last_error = None
        
        for attempt in range(1, max_retries + 1):
            try:
                log.info(f"Sending request to Gemini model {self.model} (Attempt {attempt}/{max_retries})...")
                response = requests.post(url, headers=headers, json=payload, timeout=90)
                
                # Check for rate limiting or other HTTP errors
                if response.status_code == 429:
                    delay = attempt * 15
                    log.warning(f"Gemini API rate limit hit (429). Retrying in {delay} seconds...")
                    time.sleep(delay)
                    continue
                    
                response.raise_for_status()
                
                # Parse response JSON
                res_data = response.json()
                
                # Extract text response from candidates structure
                candidates = res_data.get("candidates", [])
                if not candidates:
                    raise ValueError(f"Gemini API returned no candidates. Full response: {res_data}")
                    
                parts = candidates[0].get("content", {}).get("parts", [])
                if not parts:
                    raise ValueError(f"Gemini API candidate content contains no parts. Full response: {res_data}")
                    
                text_content = parts[0].get("text", "")
                return text_content.strip()
                
            except requests.exceptions.HTTPError as he:
                last_error = he
                status_code = he.response.status_code if he.response is not None else "Unknown"
                detail = he.response.text if he.response is not None else ""
                log.error(f"HTTP error {status_code} during Gemini API call: {detail}")
                
                if status_code in (408, 500, 502, 503, 504):
                    # Retry on server error or timeout
                    time.sleep(attempt * 2)
                    continue
                break
                
            except Exception as e:
                last_error = e
                log.error(f"Exception during Gemini API call on attempt {attempt}: {str(e)}")
                time.sleep(attempt * 2)
                continue
                
        raise last_error or RuntimeError("Failed to generate content from Gemini API after retries.")
