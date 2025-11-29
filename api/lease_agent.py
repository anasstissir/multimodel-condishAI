"""
Lease Document Agent

AI-powered agent that:
1. Reads and parses lease documents (PDF/images)
2. Extracts floor plan images
3. Extracts deposit amount and lease terms
4. Orchestrates 3D visualization generation
"""

import base64
import json
import os
import io
from typing import Any

from google import genai
from google.genai import types


def get_gemini_client() -> genai.Client:
    """Get configured Gemini client."""
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if api_key:
        return genai.Client(api_key=api_key)
    return genai.Client(vertexai=True)


async def extract_lease_info(document_bytes: bytes, mime_type: str = "application/pdf") -> dict[str, Any]:
    """
    Extract key information from a lease document.
    
    Args:
        document_bytes: The lease document bytes (PDF or image)
        mime_type: MIME type of the document
    
    Returns:
        dict with extracted lease information
    """
    client = get_gemini_client()
    
    prompt = """You are a lease document analyzer. Carefully read this lease document and extract the following information.

Return a JSON object with this EXACT structure:
{
    "property_address": "Full address of the property",
    "tenant_name": "Name of the tenant(s)",
    "landlord_name": "Name of the landlord/property manager",
    "lease_start_date": "Start date (YYYY-MM-DD format)",
    "lease_end_date": "End date (YYYY-MM-DD format)",
    "monthly_rent": {
        "amount": number,
        "currency": "USD/EUR/MAD/etc"
    },
    "security_deposit": {
        "amount": number,
        "currency": "USD/EUR/MAD/etc",
        "conditions": "Any conditions for deposit return"
    },
    "property_details": {
        "type": "apartment/house/studio/etc",
        "bedrooms": number,
        "bathrooms": number,
        "furnished": true/false,
        "parking": true/false,
        "notes": "Other property details"
    },
    "damage_liability": {
        "tenant_responsible_for": ["list of items tenant is responsible for"],
        "normal_wear_excluded": true/false,
        "inspection_required": true/false
    },
    "special_clauses": ["Any special clauses related to property condition or damages"],
    "has_floor_plan": true/false,
    "floor_plan_page": number or null
}

If any field cannot be determined from the document, use null.
Return ONLY valid JSON, no markdown or explanations."""

    try:
        parts = [
            types.Part(text=prompt),
            types.Part(inline_data=types.Blob(data=document_bytes, mime_type=mime_type)),
        ]
        
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=types.Content(role="user", parts=parts),
        )
        
        raw_text = response.text
        
        # Parse JSON
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
            return {
                "status": "partial",
                "raw_extraction": raw_text,
                "message": "Could not parse structured data, raw extraction provided"
            }
            
    except Exception as e:
        return {
            "status": "error",
            "message": f"Document analysis failed: {str(e)}"
        }


async def extract_floor_plan_from_document(document_bytes: bytes, mime_type: str = "application/pdf") -> dict[str, Any]:
    """
    Extract the floor plan image from a lease document.
    
    Uses AI to identify and extract floor plan pages/images.
    
    Args:
        document_bytes: The lease document bytes
        mime_type: MIME type of the document
    
    Returns:
        dict with extracted floor plan image
    """
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"status": "error", "message": "API key not configured"}
    
    client = genai.Client(api_key=api_key)
    
    # First, ask the model to identify if there's a floor plan and describe it
    identify_prompt = """Analyze this document carefully.

1. Does this document contain a floor plan or property layout diagram?
2. If yes, describe what the floor plan shows (rooms, layout, etc.)
3. If it's a multi-page PDF, which page contains the floor plan?

Return JSON:
{
    "has_floor_plan": true/false,
    "floor_plan_description": "Description of the floor plan if found",
    "page_number": number or null,
    "rooms_visible": ["list of rooms visible in the plan"],
    "confidence": "high/medium/low"
}"""

    try:
        parts = [
            types.Part(text=identify_prompt),
            types.Part(inline_data=types.Blob(data=document_bytes, mime_type=mime_type)),
        ]
        
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=types.Content(role="user", parts=parts),
        )
        
        raw_text = response.text
        
        # Parse the identification response
        try:
            clean_text = raw_text.strip()
            if clean_text.startswith("```"):
                clean_text = clean_text.split("```")[1]
                if clean_text.startswith("json"):
                    clean_text = clean_text[4:]
            clean_text = clean_text.strip()
            
            floor_plan_info = json.loads(clean_text)
        except:
            floor_plan_info = {"has_floor_plan": False}
        
        if not floor_plan_info.get("has_floor_plan"):
            return {
                "status": "not_found",
                "message": "No floor plan found in document",
                "floor_plan_info": floor_plan_info
            }
        
        # If floor plan exists, generate a clean version using image generation
        # The document itself can be used for 3D generation
        return {
            "status": "success",
            "floor_plan_found": True,
            "floor_plan_info": floor_plan_info,
            "document_base64": base64.b64encode(document_bytes).decode('utf-8'),
            "document_mime_type": mime_type,
            "message": "Floor plan identified in document. Use this for 3D generation."
        }
            
    except Exception as e:
        return {
            "status": "error",
            "message": f"Floor plan extraction failed: {str(e)}"
        }


async def process_lease_document(document_bytes: bytes, mime_type: str = "application/pdf") -> dict[str, Any]:
    """
    Complete lease document processing pipeline.
    
    1. Extract lease information (deposit, terms, etc.)
    2. Extract/identify floor plan
    3. Prepare data for 3D generation and inspection
    
    Args:
        document_bytes: The lease document bytes
        mime_type: MIME type of the document
    
    Returns:
        Complete processed lease data
    """
    # Run both extractions
    lease_info = await extract_lease_info(document_bytes, mime_type)
    floor_plan_result = await extract_floor_plan_from_document(document_bytes, mime_type)
    
    return {
        "status": "success",
        "lease_info": lease_info,
        "floor_plan": floor_plan_result,
        "ready_for_inspection": floor_plan_result.get("floor_plan_found", False),
        "deposit_amount": lease_info.get("security_deposit", {}).get("amount"),
        "deposit_currency": lease_info.get("security_deposit", {}).get("currency", "USD"),
    }


async def calculate_deposit_deductions(
    damages: list[dict],
    deposit_amount: float,
    currency: str = "USD",
    repair_quote: dict | None = None
) -> dict[str, Any]:
    """
    Calculate deposit deductions based on damages found.
    
    Args:
        damages: List of damages found during inspection
        deposit_amount: Original deposit amount
        currency: Currency code
        repair_quote: Optional pre-calculated repair quote
    
    Returns:
        Deposit deduction breakdown
    """
    client = get_gemini_client()
    
    damages_summary = json.dumps(damages, indent=2) if damages else "No damages found"
    quote_summary = json.dumps(repair_quote, indent=2) if repair_quote else "No quote available"
    
    prompt = f"""You are a property management financial advisor. Calculate the deposit deductions based on the inspection results.

DEPOSIT INFORMATION:
- Original Deposit: {deposit_amount} {currency}

DAMAGES FOUND:
{damages_summary}

REPAIR QUOTE (if available):
{quote_summary}

Calculate fair deductions considering:
1. Severity of each damage
2. Whether it's beyond normal wear and tear
3. Standard depreciation (paint, carpet, etc. have limited life)
4. Local regulations (deposits can only cover actual damages)

Return JSON:
{{
    "original_deposit": {deposit_amount},
    "currency": "{currency}",
    "deductions": [
        {{
            "item": "Description of damage",
            "damage_severity": "minor/moderate/major/critical",
            "deduction_amount": number,
            "justification": "Why this amount is fair",
            "is_beyond_normal_wear": true/false
        }}
    ],
    "total_deductions": number,
    "deposit_return": number,
    "summary": "Brief summary for tenant",
    "landlord_notes": "Notes for landlord",
    "disputed_items": ["Any items that might be contested"]
}}

Be fair to both parties. Only deduct for actual damages beyond normal wear."""

    try:
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=types.Content(role="user", parts=[types.Part(text=prompt)]),
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
            return {
                "status": "error",
                "message": "Could not calculate deductions",
                "raw_response": raw_text
            }
            
    except Exception as e:
        return {
            "status": "error",
            "message": f"Deduction calculation failed: {str(e)}"
        }

