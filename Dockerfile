FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# Copy API code
COPY api/ ./api/

# Copy frontend build (built separately)
COPY frontend/dist/ ./frontend/dist/

# Expose port
EXPOSE 8080

# Run the server
CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8080"]

