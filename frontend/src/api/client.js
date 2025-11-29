// Condish.ai - API Client
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// ============== Lease Document ==============

// Process complete lease document
export async function processLeaseDocument(documentBase64, mimeType = 'application/pdf', projectId = 'default') {
  const response = await fetch(`${API_BASE}/lease/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      document: documentBase64,
      mime_type: mimeType,
    }),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `Failed to process lease: ${response.status}`)
  }
  
  return response.json()
}

// Generate 3D from lease document
export async function generate3DFromDocument(documentBase64, mimeType = 'application/pdf', projectId = 'default') {
  const response = await fetch(`${API_BASE}/lease/generate-3d-from-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      document: documentBase64,
      mime_type: mimeType,
    }),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `Failed to generate 3D: ${response.status}`)
  }
  
  return response.json()
}

// ============== Floor Plan ==============

// Analyze floor plan
export async function analyzeFloorPlan(imageBase64, projectId = 'default') {
  const response = await fetch(`${API_BASE}/floor-plan/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      floor_plan_image: imageBase64,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Failed to analyze floor plan: ${response.status}`)
  }
  
  return response.json()
}

// Generate 3D image (Nano Banana)
export async function generate3DImage(imageBase64, projectId = 'default') {
  const response = await fetch(`${API_BASE}/floor-plan/generate-3d-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      floor_plan_image: imageBase64,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Failed to generate 3D image: ${response.status}`)
  }
  
  return response.json()
}

// ============== Damage Analysis ==============

// Analyze damage (compare current image with reference images)
// If no references, uses standalone detection
export async function analyzeDamage(currentImage, referenceImages = []) {
  // Use standalone endpoint if no reference images
  if (!referenceImages || referenceImages.length === 0) {
    return analyzeDamageStandalone(currentImage)
  }
  
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current_image: currentImage,
      reference_images: referenceImages,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Failed to analyze damage: ${response.status}`)
  }
  
  return response.json()
}

// Analyze damage WITHOUT reference images (standalone detection)
export async function analyzeDamageStandalone(currentImage) {
  const response = await fetch(`${API_BASE}/analyze/standalone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: currentImage,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Failed to analyze damage: ${response.status}`)
  }
  
  return response.json()
}

// ============== Quotes & Deposits ==============

// Get repair quote
export async function getRepairQuote(damages, country = 'Morocco', currency = 'MAD') {
  const response = await fetch(`${API_BASE}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      damages,
      country,
      currency,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Failed to get quote: ${response.status}`)
  }
  
  return response.json()
}

// Calculate deposit deductions
export async function calculateDepositDeductions(damages, depositAmount, currency = 'USD', repairQuote = null, projectId = 'default') {
  const response = await fetch(`${API_BASE}/deposit/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      damages,
      deposit_amount: depositAmount,
      currency,
      repair_quote: repairQuote,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Failed to calculate deductions: ${response.status}`)
  }
  
  return response.json()
}

// ============== Project ==============

// Get project data
export async function getProject(projectId) {
  const response = await fetch(`${API_BASE}/project/${projectId}`)
  
  if (!response.ok) {
    throw new Error(`Failed to get project: ${response.status}`)
  }
  
  return response.json()
}

// Health check
export async function healthCheck() {
  const response = await fetch(`${API_BASE}/health`)
  return response.json()
}
