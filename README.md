# Condish.ai 🏠✨

**Your Property's Condition, Captured & Compared**

AI-powered property inspection that captures check-in conditions and compares them at check-out — with beautiful 3D visualization and fair deposit calculations.

## What is Condish?

Condish (short for "condition") is an AI-powered solution that:
- 📸 **Captures** property condition at move-in
- 🔍 **Compares** with move-out state using AI vision
- 💰 **Calculates** fair deposit deductions
- 🤝 **Creates** transparent reports for landlords & tenants

## Features

- 📐 **Floor Plan Analysis** - Upload 2D floor plans or lease documents, AI identifies all rooms
- 🎨 **3D Visualization** - Generates stunning 3D home renders for guided inspections
- 📸 **Check-In/Check-Out** - Capture reference photos and compare at move-out
- 🔍 **Live Damage Detection** - Real-time camera inspection with AI analysis
- 💰 **Deposit Calculation** - Fair, AI-powered deduction calculations
- 📊 **Inspection Reports** - Complete room-by-room reports with repair quotes

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- Google AI Studio API Key ([Get one here](https://aistudio.google.com/app/apikey))

### Backend Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e .

# Set API key
export GEMINI_API_KEY='your-api-key-here'

# Run server
uvicorn api.server:app --reload --port 8080
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Access the App

- **Frontend**: http://localhost:5173
- **API**: http://localhost:8080
- **API Docs**: http://localhost:8080/docs

## Project Structure

```
condish-ai/
├── api/                    # Python backend
│   ├── server.py          # FastAPI application
│   ├── floor_plan.py      # Floor plan analysis & 3D generation
│   ├── damage_analyzer.py # Damage detection & quotes
│   └── lease_agent.py     # Lease document processing
├── frontend/              # React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── store/         # Zustand state
│   │   ├── api/           # API client
│   │   └── styles/        # CSS styles
│   └── index.html
├── pyproject.toml         # Python dependencies
├── Dockerfile             # Container config
└── README.md
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/floor-plan/parse` | POST | Analyze floor plan image |
| `/floor-plan/generate-3d-image` | POST | Generate 3D visualization |
| `/lease/process` | POST | Process lease document |
| `/analyze` | POST | Analyze image for damage |
| `/analyze/standalone` | POST | Quick damage detection |
| `/quote` | POST | Generate repair quote |
| `/deposit/calculate` | POST | Calculate deposit deductions |
| `/health` | GET | Health check |

## Tech Stack

- **Backend**: FastAPI, Python, Google Gemini AI
- **Frontend**: React, Vite, Framer Motion, Zustand
- **AI**: Gemini 2.5 Flash Image (for 3D generation)

## The Condish Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  CHECK-IN   │ ──► │  MOVE-OUT   │ ──► │   REPORT    │
│  Capture    │     │  Compare    │     │  Generate   │
│  condition  │     │  with AI    │     │  fair quote │
└─────────────┘     └─────────────┘     └─────────────┘
```

## License

MIT License

---

**Condish.ai** — Fair property handovers, powered by AI 🤖
