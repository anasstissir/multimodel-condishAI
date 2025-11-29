"""
Condish.ai - FastAPI Server

Production-ready API for:
- Property condition capture & comparison
- Lease document processing
- Floor plan analysis and 3D visualization
- Damage detection with live camera
- Repair quote and deposit deduction calculation
"""

import base64
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from api.damage_analyzer import analyze_damage, analyze_damage_standalone, generate_repair_quote
from api.floor_plan import (
    parse_floor_plan,
    generate_3d_layout,
    generate_3d_floor_plan_image,
    create_inspection_checklist,
)
from api.lease_agent import (
    process_lease_document,
    extract_lease_info,
    extract_floor_plan_from_document,
    calculate_deposit_deductions,
)

# Create FastAPI app
app = FastAPI(
    title="Condish.ai",
    description="AI-powered property condition capture & comparison for fair handovers",
    version="1.0.0",
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static files
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")


# ============== Models ==============

class AnalyzeRequest(BaseModel):
    """Request for damage analysis."""
    current_image: str  # Base64 encoded
    reference_images: list[str]  # Base64 encoded list


class QuoteRequest(BaseModel):
    """Request for repair quote."""
    damages: list[dict[str, Any]]
    country: str
    currency: str
    deposit_amount: float | None = None  # Optional deposit for comparison


class FloorPlanRequest(BaseModel):
    """Request for floor plan processing."""
    project_id: str
    floor_plan_image: str  # Base64 encoded


class LeaseDocumentRequest(BaseModel):
    """Request for lease document processing."""
    project_id: str
    document: str  # Base64 encoded PDF or image
    mime_type: str = "application/pdf"


class DepositDeductionRequest(BaseModel):
    """Request for deposit deduction calculation."""
    project_id: str
    damages: list[dict[str, Any]]
    deposit_amount: float
    currency: str = "USD"
    repair_quote: dict[str, Any] | None = None


# ============== Health ==============

@app.get("/")
async def root():
    """Health check."""
    return {"status": "healthy", "service": "Condish.ai", "version": "1.0.0"}


@app.get("/health")
async def health():
    """Health check for cloud deployments."""
    return {"status": "healthy"}


# ============== Lease Document Processing ==============

# In-memory storage
projects_db: dict[str, dict] = {}
floor_plans_db: dict[str, dict] = {}
inspection_state_db: dict[str, dict] = {}


@app.post("/lease/process")
async def process_lease_endpoint(request: LeaseDocumentRequest):
    """
    Process a complete lease document.
    
    Extracts:
    - Lease terms (deposit, rent, dates)
    - Property details
    - Floor plan (if present)
    
    Returns all extracted data ready for inspection workflow.
    """
    try:
        document_bytes = base64.b64decode(request.document)
        
        # Process the entire lease document
        result = await process_lease_document(document_bytes, request.mime_type)
        
        # Store project data
        projects_db[request.project_id] = {
            "lease_info": result.get("lease_info"),
            "deposit_amount": result.get("deposit_amount"),
            "deposit_currency": result.get("deposit_currency"),
            "document_bytes": document_bytes,
            "mime_type": request.mime_type,
        }
        
        return {
            "status": "success",
            "project_id": request.project_id,
            **result,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/lease/extract-info")
async def extract_lease_info_endpoint(request: LeaseDocumentRequest):
    """
    Extract only lease information (deposit, terms, etc.) from document.
    """
    try:
        document_bytes = base64.b64decode(request.document)
        result = await extract_lease_info(document_bytes, request.mime_type)
        
        # Update project if exists
        if request.project_id in projects_db:
            projects_db[request.project_id]["lease_info"] = result
            if result.get("security_deposit"):
                projects_db[request.project_id]["deposit_amount"] = result["security_deposit"].get("amount")
                projects_db[request.project_id]["deposit_currency"] = result["security_deposit"].get("currency", "USD")
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/lease/extract-floor-plan")
async def extract_floor_plan_endpoint(request: LeaseDocumentRequest):
    """
    Extract floor plan from lease document and prepare for 3D generation.
    """
    try:
        document_bytes = base64.b64decode(request.document)
        result = await extract_floor_plan_from_document(document_bytes, request.mime_type)
        
        if result.get("floor_plan_found"):
            # Store for later 3D generation
            floor_plans_db[request.project_id] = {
                "document_bytes": document_bytes,
                "mime_type": request.mime_type,
                "floor_plan_info": result.get("floor_plan_info"),
            }
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/lease/generate-3d-from-document")
async def generate_3d_from_document_endpoint(request: LeaseDocumentRequest):
    """
    Generate 3D visualization directly from lease document containing floor plan.
    
    This is the complete pipeline:
    1. Extract floor plan from document
    2. Parse rooms and layout
    3. Generate beautiful 3D visualization
    """
    try:
        document_bytes = base64.b64decode(request.document)
        mime_type = request.mime_type
        
        # First, check if document has a floor plan
        floor_plan_check = await extract_floor_plan_from_document(document_bytes, mime_type)
        
        if not floor_plan_check.get("floor_plan_found"):
            return {
                "status": "no_floor_plan",
                "message": "No floor plan found in the lease document",
                "floor_plan_info": floor_plan_check.get("floor_plan_info"),
            }
        
        # Parse the floor plan to get room data (pass mime_type)
        floor_plan_data = await parse_floor_plan(document_bytes, mime_type)
        
        # Store the parsed data
        floor_plans_db[request.project_id] = {
            "data": floor_plan_data,
            "document_bytes": document_bytes,
            "mime_type": mime_type,
        }
        
        # Generate 3D layout data
        layout_3d = await generate_3d_layout(floor_plan_data)
        
        # Create inspection checklist
        checklist = await create_inspection_checklist(floor_plan_data)
        inspection_state_db[request.project_id] = checklist
        
        # Generate 3D image (pass mime_type for proper handling of PDFs)
        image_result = await generate_3d_floor_plan_image(
            floor_plan_image=document_bytes,
            floor_plan_data=floor_plan_data,
            mime_type=mime_type,
        )
        
        return {
            "status": "success",
            "project_id": request.project_id,
            "floor_plan": floor_plan_data,
            "layout_3d": layout_3d,
            "checklist": checklist,
            "image_3d": image_result,
            "floor_plan_info": floor_plan_check.get("floor_plan_info"),
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== Floor Plan ==============

@app.post("/floor-plan/parse")
async def parse_floor_plan_endpoint(request: FloorPlanRequest):
    """
    Parse a 2D floor plan and identify rooms.
    
    Returns room layout and inspection checklist.
    """
    try:
        image_bytes = base64.b64decode(request.floor_plan_image)
        
        # Parse floor plan
        floor_plan_data = await parse_floor_plan(image_bytes)
        
        # Store for later use
        floor_plans_db[request.project_id] = {
            "data": floor_plan_data,
            "image_bytes": image_bytes,
        }
        
        # Generate layout and checklist
        layout_3d = await generate_3d_layout(floor_plan_data)
        checklist = await create_inspection_checklist(floor_plan_data)
        inspection_state_db[request.project_id] = checklist
        
        return {
            "status": "success",
            "project_id": request.project_id,
            "floor_plan": floor_plan_data,
            "layout_3d": layout_3d,
            "checklist": checklist,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/floor-plan/generate-3d-image")
async def generate_3d_image_endpoint(request: FloorPlanRequest):
    """
    Generate a beautiful 3D visualization of the floor plan.
    
    Uses AI to create a photorealistic 3D home render.
    """
    try:
        image_bytes = base64.b64decode(request.floor_plan_image)
        
        # Get floor plan data if available
        floor_plan_data = None
        if request.project_id in floor_plans_db:
            stored = floor_plans_db[request.project_id]
            floor_plan_data = stored.get("data") if isinstance(stored, dict) else stored
        
        # Generate 3D image
        result = await generate_3d_floor_plan_image(
            floor_plan_image=image_bytes,
            floor_plan_data=floor_plan_data,
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== Damage Analysis ==============

@app.post("/analyze")
async def analyze_damage_endpoint(request: AnalyzeRequest):
    """
    Analyze an image for damage by comparing with references.
    
    Returns detected damages with severity and location.
    """
    try:
        current_bytes = base64.b64decode(request.current_image)
        reference_bytes = [base64.b64decode(img) for img in request.reference_images]
        
        result = await analyze_damage(
            current_image=current_bytes,
            reference_images=reference_bytes,
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AnalyzeStandaloneRequest(BaseModel):
    """Request to analyze a single image for damage without reference."""
    image: str  # Base64 encoded image


@app.post("/analyze/standalone")
async def analyze_damage_standalone_endpoint(request: AnalyzeStandaloneRequest):
    """
    Analyze an image for damage WITHOUT reference images.
    
    Useful for:
    - Quick damage detection
    - When no check-in photos exist
    - Initial property assessment
    
    Returns detected damages with severity and location.
    """
    try:
        image_bytes = base64.b64decode(request.image)
        result = await analyze_damage_standalone(image_bytes)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/quote")
async def generate_quote_endpoint(request: QuoteRequest):
    """
    Generate a repair quote for detected damages.
    
    Returns materials, labor, and total cost estimate.
    """
    try:
        result = await generate_repair_quote(
            damages=request.damages,
            country=request.country,
            currency=request.currency,
            deposit_amount=request.deposit_amount,
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== Deposit Deductions ==============

@app.post("/deposit/calculate")
async def calculate_deductions_endpoint(request: DepositDeductionRequest):
    """
    Calculate deposit deductions based on damages found.
    
    Returns:
    - Itemized deductions with justifications
    - Total deductions
    - Amount to return to tenant
    - Notes for both parties
    """
    try:
        result = await calculate_deposit_deductions(
            damages=request.damages,
            deposit_amount=request.deposit_amount,
            currency=request.currency,
            repair_quote=request.repair_quote,
        )
        
        # Store in project if exists
        if request.project_id in projects_db:
            projects_db[request.project_id]["deposit_deductions"] = result
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/project/{project_id}")
async def get_project(project_id: str):
    """
    Get all project data including lease info, floor plan, and inspection results.
    """
    project = projects_db.get(project_id, {})
    floor_plan = floor_plans_db.get(project_id, {})
    inspection = inspection_state_db.get(project_id, {})
    
    return {
        "project_id": project_id,
        "lease_info": project.get("lease_info"),
        "deposit_amount": project.get("deposit_amount"),
        "deposit_currency": project.get("deposit_currency"),
        "floor_plan": floor_plan.get("data"),
        "inspection_checklist": inspection,
        "deposit_deductions": project.get("deposit_deductions"),
    }


# ============== Frontend ==============

@app.get("/app")
async def serve_frontend():
    """Serve the web application."""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    raise HTTPException(status_code=404, detail="Frontend not built. Run: cd frontend && npm run build")


# Run with: uvicorn api.server:app --reload --port 8080
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
