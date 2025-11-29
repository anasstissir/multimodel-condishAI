# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Damage analysis service using Gemini Vision - Cloud deployable."""

import json
import os
from typing import Any

from google import genai
from google.genai import types


def get_gemini_client() -> genai.Client:
    """Get configured Gemini client."""
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if api_key:
        return genai.Client(api_key=api_key)
    return genai.Client(vertexai=True)


async def analyze_damage(
    current_image: bytes,
    reference_images: list[bytes],
    reference_names: list[str] | None = None,
) -> dict[str, Any]:
    """
    Analyze an image for damage by comparing with reference images.
    
    ALWAYS looks for damage in the current image, regardless of angle match.
    
    Args:
        current_image: The image to analyze (JPEG/PNG bytes)
        reference_images: List of reference images (undamaged state)
        reference_names: Optional names for reference images
    
    Returns:
        dict with analysis results including:
        - status: "damage_found", "no_damage", "scene_mismatch"
        - damage_found: bool
        - damages: list of damage items
        - message: human-readable result
        - raw_analysis: full Gemini response
    """
    client = get_gemini_client()
    
    if reference_names is None:
        reference_names = [f"reference_{i+1}" for i in range(len(reference_images))]
    
    # Build multimodal prompt
    parts = []
    
    # First detect if same room, then find ONLY NEW damage (not pre-existing)
    instruction = """You are an EXPERT PROPERTY DAMAGE INSPECTOR for move-out inspections.

## STEP 1: CHECK IF SAME ROOM/SPACE (CRITICAL!)

FIRST, determine if the CURRENT IMAGE shows the SAME ROOM or area as the REFERENCE IMAGE(S).

Look for matching features:
- Same room type (kitchen, bathroom, bedroom, living room, hallway, etc.)
- Same architectural features (windows, doors, walls, ceiling)
- Same fixtures or furniture layout
- Same perspective/area of the property

🚫 If DIFFERENT ROOM or completely different space:
Return JSON:
{
  "status": "wrong_room",
  "same_room": false,
  "damage_found": false,
  "reference_shows": "describe what the check-in reference image shows (e.g., 'kitchen with white cabinets')",
  "current_shows": "describe what the current image shows (e.g., 'living room with sofa')",
  "message": "Wrong room! The check-in photo shows [X] but you're looking at [Y]. Please point camera at the correct area.",
  "suggestion": "Move to the [reference room type] to continue inspection"
}

✅ If SAME ROOM (even if different angle), proceed to Step 2.

## STEP 2: FIND ONLY NEW DAMAGE (if same room)

The REFERENCE IMAGE(S) show the property condition at CHECK-IN (move-in).
The CURRENT IMAGE shows the property NOW at CHECK-OUT (move-out).

⚠️ CRITICAL: ONLY report damage that is NEW - damage that exists NOW but did NOT exist at check-in.

## IGNORE (DO NOT REPORT):
- Pre-existing conditions visible in the reference image
- Normal wear and tear
- Marks/stains that were already there at check-in
- Anything that looks the same in both images

## REPORT ONLY NEW DAMAGE:
- NEW cracks that weren't there before
- NEW holes (not visible in reference)
- NEW stains or damage
- NEW broken items
- Anything that got WORSE since check-in

## RESPONSE FORMAT (when same room)
Return JSON:
{
  "status": "new_damage_found" or "no_new_damage",
  "same_room": true,
  "damage_found": true/false,
  "angle_matches_reference": true/false,
  "damages": [
    {
      "type": "water_damage/crack/hole/dent/scratch/stain/peeling/mold/wear/other",
      "location": "where in the image",
      "severity": "minor/moderate/major/critical",
      "size": "estimated size",
      "description": "detailed description of the NEW damage",
      "likely_cause": "what probably caused this",
      "is_new": true
    }
  ],
  "pre_existing_noted": ["list of conditions that exist in BOTH images - not charged"],
  "overall_condition": "good/fair/poor/critical",
  "message": "Summary - mention only NEW damage that tenant is responsible for",
  "repair_urgency": "none/low/medium/high/immediate"
}

IMPORTANT RULES:
1. FIRST check if it's the same room - if not, return "wrong_room" status
2. If damage exists in BOTH check-in and check-out images → DO NOT REPORT (pre-existing)
3. Only report damage that is NEW (not visible in reference)
4. Return ONLY valid JSON, no markdown or extra text

CHECK-IN REFERENCE IMAGE(S) - showing condition when tenant moved in:
"""
    parts.append(types.Part(text=instruction))
    
    # Add reference images
    for i, ref_bytes in enumerate(reference_images):
        name = reference_names[i] if i < len(reference_names) else f"check_in_photo_{i+1}"
        parts.append(types.Part(text=f"\n[CHECK-IN {name}]:"))
        parts.append(types.Part(inline_data=types.Blob(data=ref_bytes, mime_type="image/jpeg")))
    
    parts.append(types.Part(text="\n\n>>> CHECK-OUT IMAGE (current condition) - Compare with check-in above <<<"))
    parts.append(types.Part(inline_data=types.Blob(data=current_image, mime_type="image/jpeg")))
    parts.append(types.Part(text="\n\nCompare CHECK-OUT with CHECK-IN. Return JSON with ONLY NEW damage (not in check-in):"))
    
    # Send to Gemini
    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=types.Content(role="user", parts=parts),
    )
    
    raw_text = response.text
    
    # Parse JSON from response
    try:
        # Clean up response if it has markdown code blocks
        clean_text = raw_text.strip()
        if clean_text.startswith("```"):
            clean_text = clean_text.split("```")[1]
            if clean_text.startswith("json"):
                clean_text = clean_text[4:]
        clean_text = clean_text.strip()
        
        result = json.loads(clean_text)
        result["raw_analysis"] = raw_text
        return result
    except json.JSONDecodeError:
        # Return raw analysis if JSON parsing fails
        has_damage = any(word in raw_text.lower() for word in [
            "damage", "crack", "hole", "dent", "scratch", "stain", 
            "peel", "mold", "water", "broken", "chip", "wear"
        ]) and "no damage" not in raw_text.lower()
        
        return {
            "status": "damage_found" if has_damage else "no_damage",
            "damage_found": has_damage,
            "message": raw_text,
            "raw_analysis": raw_text,
        }


async def analyze_damage_standalone(current_image: bytes) -> dict[str, Any]:
    """
    Analyze an image for damage WITHOUT reference images.
    
    Useful for quick damage detection or when no check-in photos exist.
    
    Args:
        current_image: The image to analyze (JPEG/PNG bytes)
    
    Returns:
        dict with analysis results
    """
    client = get_gemini_client()
    
    prompt = """You are an EXPERT PROPERTY DAMAGE INSPECTOR. Analyze this image for ANY damage or issues.

LOOK FOR:
- Water damage (stains, peeling, bubbling, discoloration on walls/ceilings)
- Cracks (hairline to major structural cracks)
- Holes (any size)
- Dents or impact marks
- Scratches and scuffs
- Mold or mildew (dark spots, fuzzy growth)
- Peeling paint or wallpaper
- Broken or damaged fixtures
- Stains of any kind
- Excessive wear and tear
- Chipped surfaces
- Damaged flooring

BE THOROUGH AND REPORT EVERYTHING YOU SEE.

Return JSON:
{
  "status": "damage_found" or "no_damage",
  "damage_found": true/false,
  "damages": [
    {
      "type": "water_damage/crack/hole/dent/scratch/stain/peeling/mold/wear/other",
      "location": "where in the image",
      "severity": "minor/moderate/major/critical",
      "size": "estimated size",
      "description": "detailed description",
      "likely_cause": "probable cause"
    }
  ],
  "overall_condition": "good/fair/poor/critical",
  "message": "Summary of findings",
  "repair_urgency": "none/low/medium/high/immediate"
}

Return ONLY valid JSON."""
    
    parts = [
        types.Part(text=prompt),
        types.Part(inline_data=types.Blob(data=current_image, mime_type="image/jpeg")),
    ]
    
    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=types.Content(role="user", parts=parts),
    )
    
    raw_text = response.text
    
    try:
        clean_text = raw_text.strip()
        if clean_text.startswith("```"):
            clean_text = clean_text.split("```")[1]
            if clean_text.startswith("json"):
                clean_text = clean_text[4:]
        clean_text = clean_text.strip()
        
        result = json.loads(clean_text)
        result["raw_analysis"] = raw_text
        return result
    except json.JSONDecodeError:
        has_damage = any(word in raw_text.lower() for word in [
            "damage", "crack", "hole", "dent", "scratch", "stain", 
            "peel", "mold", "water", "broken", "chip", "wear"
        ]) and "no damage" not in raw_text.lower()
        
        return {
            "status": "damage_found" if has_damage else "no_damage",
            "damage_found": has_damage,
            "message": raw_text,
            "raw_analysis": raw_text,
        }


async def generate_repair_quote(
    damages: list[dict[str, Any]],
    country: str,
    currency: str,
    deposit_amount: float | None = None,
) -> dict[str, Any]:
    """
    Generate a repair quote for detected damages.
    
    Args:
        damages: List of damage items from analyze_damage
        country: Country for pricing (e.g., "Morocco", "France")
        currency: Currency code (e.g., "MAD", "EUR", "USD")
        deposit_amount: Optional security deposit to compare against
    
    Returns:
        dict with quote including materials, labor, and totals
    """
    client = get_gemini_client()
    
    if not damages:
        return {
            "status": "no_damages",
            "message": "No damages to quote",
            "total": 0,
            "currency": currency,
        }
    
    # Build prompt for quote generation
    damages_text = "\n".join([
        f"- {d.get('type', 'damage')}: {d.get('description', 'N/A')} "
        f"(Location: {d.get('location', 'N/A')}, Severity: {d.get('severity', 'N/A')}, "
        f"Size: {d.get('size', 'N/A')})"
        for d in damages
    ])
    
    deposit_info = ""
    if deposit_amount:
        deposit_info = f"\n\nSECURITY DEPOSIT: {deposit_amount} {currency}\nCalculate if repairs exceed the deposit."
    
    prompt = f"""You are a repair cost estimator. Generate a detailed repair quote for the following damages in {country} using {currency}.

DAMAGES TO REPAIR:
{damages_text}
{deposit_info}

For each damage, estimate:
1. Materials needed with quantities and realistic local prices
2. Labor hours and costs based on {country} rates

Return JSON format:
{{
  "country": "{country}",
  "currency": "{currency}",
  "materials": [
    {{"name": "material name", "quantity": 1, "unit": "piece/kg/m²", "unit_price": 0, "total": 0, "for_damage": "which damage"}}
  ],
  "labor": [
    {{"task": "description", "hours": 0, "hourly_rate": 0, "total": 0, "worker_type": "painter/plumber/general"}}
  ],
  "summary": {{
    "materials_total": 0,
    "labor_total": 0,
    "subtotal": 0,
    "contingency_10_percent": 0,
    "grand_total": 0
  }},
  "deposit_comparison": {{
    "deposit_amount": {deposit_amount or 0},
    "repair_cost": 0,
    "difference": 0,
    "covers_repairs": true/false,
    "tenant_owes_extra": 0
  }},
  "notes": "any additional notes about the repairs"
}}

Use REALISTIC prices for {country} in 2024/2025. Return ONLY valid JSON.
"""
    
    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    
    raw_text = response.text
    
    try:
        clean_text = raw_text.strip()
        if clean_text.startswith("```"):
            clean_text = clean_text.split("```")[1]
            if clean_text.startswith("json"):
                clean_text = clean_text[4:]
        clean_text = clean_text.strip()
        
        result = json.loads(clean_text)
        result["status"] = "quote_generated"
        return result
    except json.JSONDecodeError:
        return {
            "status": "quote_generated",
            "raw_quote": raw_text,
            "message": "Quote generated (see raw_quote)",
        }
