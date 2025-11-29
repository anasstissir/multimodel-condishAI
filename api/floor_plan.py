"""
Floor Plan Parser & 3D Visualization Generator

Uses Gemini AI to:
1. Analyze floor plans and identify rooms
2. Generate beautiful 3D visualizations
3. Create inspection checklists
"""

import base64
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


def detect_mime_type(data: bytes) -> str:
    """Detect the MIME type from file bytes."""
    # PDF signature
    if data[:4] == b'%PDF':
        return "application/pdf"
    # PNG signature
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    # JPEG signature
    if data[:2] == b'\xff\xd8':
        return "image/jpeg"
    # GIF signature
    if data[:6] in (b'GIF87a', b'GIF89a'):
        return "image/gif"
    # Default to JPEG
    return "image/jpeg"


async def describe_floor_plan_from_document(document_bytes: bytes, mime_type: str) -> dict[str, Any]:
    """
    Extract floor plan description from a document (PDF or image).
    
    Returns a detailed text description that can be used for 3D generation.
    """
    client = get_gemini_client()
    
    prompt = """Analyze this document and describe the floor plan in detail.

If this document contains a floor plan, provide:
1. The type of property (apartment, house, studio)
2. Number of floors/levels
3. List of ALL rooms with their approximate sizes and positions
4. How rooms are connected (which rooms are adjacent)
5. Location of doors, windows, stairs
6. Any special features

Format your response as:

PROPERTY TYPE: [type]
FLOORS: [number]

ROOMS:
- [Room name]: [size estimate], [position in property], [connected to which rooms]
(repeat for all rooms)

SPECIAL FEATURES:
- [feature 1]
- [feature 2]

LAYOUT DESCRIPTION:
[A paragraph describing the overall layout, how you would walk through the property]

If there is NO floor plan in this document, respond with:
NO_FLOOR_PLAN: This document does not contain a floor plan."""

    try:
        parts = [
            types.Part(text=prompt),
            types.Part(inline_data=types.Blob(data=document_bytes, mime_type=mime_type)),
        ]
        
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=types.Content(role="user", parts=parts),
        )
        
        text = response.text
        
        if "NO_FLOOR_PLAN" in text:
            return {
                "status": "no_floor_plan",
                "message": "No floor plan found in document"
            }
        
        return {
            "status": "success",
            "description": text,
            "has_floor_plan": True
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to analyze document: {str(e)}"
        }


async def generate_3d_floor_plan_image(
    floor_plan_image: bytes,
    floor_plan_data: dict[str, Any] | None = None,
    mime_type: str | None = None,
) -> dict[str, Any]:
    """
    Generate a photorealistic 3D home visualization from a floor plan.
    
    Uses Gemini 3 to create stunning 3D renders.
    For PDFs, first extracts description then generates based on that.
    """
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {
            "status": "error",
            "message": "API key not set. Get one from https://aistudio.google.com/app/apikey",
        }
    
    # Detect mime type if not provided
    if not mime_type:
        mime_type = detect_mime_type(floor_plan_image)
    
    client = genai.Client(api_key=api_key)
    
    # For PDFs, we need to first get a description, then generate based on text
    if mime_type == "application/pdf":
        # Get floor plan description from PDF
        description_result = await describe_floor_plan_from_document(floor_plan_image, mime_type)
        
        if description_result.get("status") != "success":
            return description_result
        
        floor_plan_description = description_result.get("description", "")
        
        # Generate 3D based on text description only (no image input for PDF)
        prompt = f"""CRITICAL: Create a 3D visualization that EXACTLY matches this floor plan description.

FLOOR PLAN DESCRIPTION:
{floor_plan_description}

⚠️ STRICT RULES - FOLLOW THE DESCRIPTION EXACTLY:
1. ONLY include rooms that are MENTIONED in the description - NO EXTRA ROOMS
2. If description says 2 bedrooms, render EXACTLY 2 bedrooms - NOT 3, NOT 4
3. If description says 1 bathroom, render EXACTLY 1 bathroom - NOT more
4. Match the layout and positions as described
5. DO NOT hallucinate or invent rooms not in the description
6. NO TEXT LABELS or annotations

ADD ONLY THESE VISUAL ENHANCEMENTS:
- Appropriate furniture for each room type
- Warm wood flooring or tiles
- White/cream walls
- Natural lighting
- Modern, clean aesthetic

STYLE:
- Isometric 3D cutaway view from above
- Photorealistic quality
- Clean white/light background
- Warm atmosphere

⚠️ IMPORTANT: Render ONLY what is described - no additions."""

        try:
            model = "gemini-2.5-flash-image"
            
            contents = [
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=prompt)],
                ),
            ]
            
            config = types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"])
            
            generated_image_b64 = None
            text_response = ""
            result_mime_type = "image/png"
            
            for chunk in client.models.generate_content_stream(
                model=model,
                contents=contents,
                config=config,
            ):
                if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                    part = chunk.candidates[0].content.parts[0]
                    if part.inline_data and part.inline_data.data:
                        generated_image_b64 = base64.b64encode(part.inline_data.data).decode('utf-8')
                        result_mime_type = part.inline_data.mime_type or "image/png"
                    elif hasattr(part, 'text') and part.text:
                        text_response += part.text
            
            if generated_image_b64:
                return {
                    "status": "success",
                    "image_base64": generated_image_b64,
                    "mime_type": result_mime_type,
                    "description": text_response or "3D visualization generated from PDF",
                    "source": "pdf_description"
                }
            
            return {"status": "error", "message": "No image generated from PDF description", "text_response": text_response}
                
        except Exception as e:
            return {"status": "error", "message": f"PDF 3D generation failed: {str(e)}"}
    
    # For images, use the original approach with STRICT blueprint adherence
    prompt = """CRITICAL: Create a 3D visualization that EXACTLY matches this 2D floor plan blueprint.

⚠️ STRICT RULES - FOLLOW THE BLUEPRINT EXACTLY:
1. ONLY include rooms that are VISIBLE in this floor plan - DO NOT ADD ANY EXTRA ROOMS
2. If the plan shows 2 bedrooms, render EXACTLY 2 bedrooms - NOT 3, NOT 4
3. If the plan shows 1 bathroom, render EXACTLY 1 bathroom - NOT more
4. Match the EXACT LAYOUT and SHAPE of each room as shown
5. Position rooms EXACTLY where they appear in the blueprint
6. Keep the SAME PROPORTIONS between rooms as the blueprint
7. DO NOT hallucinate or invent rooms that don't exist in the plan
8. NO TEXT LABELS or annotations on the image

FAITHFUL REPRODUCTION:
- Copy the floor plan layout EXACTLY
- Same number of bedrooms as shown
- Same number of bathrooms as shown  
- Kitchen exactly where shown
- Living areas exactly where shown
- Hallways and stairs exactly where shown
- Doors and windows in the same positions

ADD ONLY THESE VISUAL ENHANCEMENTS:
- Appropriate furniture in each room (beds, sofas, tables, etc.)
- Warm wood flooring or tiles
- White/cream walls
- Natural lighting through windows
- Modern, clean aesthetic

RENDERING STYLE:
- Isometric 3D cutaway view from above
- Photorealistic quality
- Clean white/light background
- Warm, inviting atmosphere

⚠️ IMPORTANT: Count the rooms in the blueprint carefully. Reproduce ONLY what exists - no additions, no omissions."""

    try:
        model = "gemini-2.5-flash-image"
        
        # Ensure we're using image mime type
        image_mime = mime_type if mime_type.startswith("image/") else "image/jpeg"
        
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(data=floor_plan_image, mime_type=image_mime),
                ],
            ),
        ]
        
        config = types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"])
        
        generated_image_b64 = None
        text_response = ""
        result_mime_type = "image/png"
        
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=config,
        ):
            if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                part = chunk.candidates[0].content.parts[0]
                if part.inline_data and part.inline_data.data:
                    generated_image_b64 = base64.b64encode(part.inline_data.data).decode('utf-8')
                    result_mime_type = part.inline_data.mime_type or "image/png"
                elif hasattr(part, 'text') and part.text:
                    text_response += part.text
        
        if generated_image_b64:
            return {
                "status": "success",
                "image_base64": generated_image_b64,
                "mime_type": result_mime_type,
                "description": text_response or "3D visualization generated",
            }
        
        return {"status": "error", "message": "No image generated", "text_response": text_response}
            
    except Exception as e:
        return {"status": "error", "message": f"Image generation failed: {str(e)}"}


async def parse_floor_plan(floor_plan_image: bytes, mime_type: str | None = None) -> dict[str, Any]:
    """
    Analyze a floor plan image or document and extract room information.
    
    Returns structured data about rooms, their positions, and inspection route.
    """
    client = get_gemini_client()
    
    # Detect mime type
    if not mime_type:
        mime_type = detect_mime_type(floor_plan_image)
    
    instruction = """Analyze this floor plan and extract room information.

Return JSON with this structure:
{
  "property_type": "apartment/house/studio",
  "total_rooms": number,
  "rooms": [
    {
      "id": "room_1",
      "name": "Living Room",
      "type": "living/bedroom/bathroom/kitchen/hallway/other",
      "position": {"x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100},
      "features": ["window", "door"],
      "inspection_priority": "high/medium/low",
      "inspection_tips": ["Check corners", "Inspect windows"]
    }
  ],
  "inspection_route": ["room_1", "room_2"],
  "entry_point": "room_1"
}

Return ONLY valid JSON."""
    
    parts = [
        types.Part(text=instruction),
        types.Part(inline_data=types.Blob(data=floor_plan_image, mime_type=mime_type)),
    ]
    
    try:
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
            result["status"] = "success"
            return result
        except json.JSONDecodeError:
            return {"status": "success", "raw_analysis": raw_text, "rooms": []}
    except Exception as e:
        return {"status": "error", "message": str(e), "rooms": []}


async def generate_3d_layout(floor_plan_data: dict[str, Any]) -> dict[str, Any]:
    """Generate 3D layout data from parsed floor plan."""
    rooms = floor_plan_data.get("rooms", [])
    
    room_colors = {
        "living": "#4CAF50", "bedroom": "#2196F3", "bathroom": "#00BCD4",
        "kitchen": "#FF9800", "hallway": "#9E9E9E", "other": "#607D8B",
    }
    
    rooms_3d = []
    for room in rooms:
        pos = room.get("position", {})
        rooms_3d.append({
            "id": room.get("id", ""),
            "name": room.get("name", ""),
            "type": room.get("type", "other"),
            "color": room_colors.get(room.get("type", "").lower(), "#607D8B"),
            "geometry": {
                "x": pos.get("x", 0), "z": pos.get("y", 0),
                "width": pos.get("width", 10), "depth": pos.get("height", 10),
            },
            "inspection_priority": room.get("inspection_priority", "medium"),
        })
    
    return {
        "type": "3d_floor_plan",
        "rooms": rooms_3d,
        "inspection_route": floor_plan_data.get("inspection_route", []),
    }


async def create_inspection_checklist(floor_plan_data: dict[str, Any]) -> dict[str, Any]:
    """Create a room-by-room inspection checklist."""
    rooms = floor_plan_data.get("rooms", [])
    inspection_route = floor_plan_data.get("inspection_route", [])
    
    route_order = {room_id: i for i, room_id in enumerate(inspection_route)}
    
    base_items = [
        {"item": "Walls", "checked": False},
        {"item": "Ceiling", "checked": False},
        {"item": "Floor", "checked": False},
    ]
    
    type_items = {
        "bathroom": [{"item": "Toilet", "checked": False}, {"item": "Sink", "checked": False}, {"item": "Shower", "checked": False}],
        "kitchen": [{"item": "Cabinets", "checked": False}, {"item": "Countertops", "checked": False}, {"item": "Appliances", "checked": False}],
        "bedroom": [{"item": "Windows", "checked": False}, {"item": "Closet", "checked": False}],
        "living": [{"item": "Windows", "checked": False}, {"item": "Outlets", "checked": False}],
    }
    
    checklist = []
    for room in sorted(rooms, key=lambda r: route_order.get(r.get("id", ""), 999)):
        room_type = room.get("type", "other")
        checklist.append({
            "room_id": room.get("id", ""),
            "room_name": room.get("name", ""),
            "room_type": room_type,
            "status": "pending",
            "priority": room.get("inspection_priority", "medium"),
            "inspection_items": base_items + type_items.get(room_type, []),
            "tips": room.get("inspection_tips", []),
            "damages_found": [],
        })
    
    return {
        "status": "success",
        "total_rooms": len(rooms),
        "checklist": checklist,
        "navigation": {
            "current_room": None,
            "next_room": checklist[0]["room_id"] if checklist else None,
            "completed_rooms": 0,
            "total_rooms": len(checklist),
        },
    }
