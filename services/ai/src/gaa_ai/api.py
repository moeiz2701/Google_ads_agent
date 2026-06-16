"""FastAPI surface for the AI service.

The Node app calls POST /analyze to run Module 2 and get an AnalysisObject back.
Generation (Module 3) endpoints will be added here later.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException

from gaa_ai.schemas import AnalysisInput, AnalysisObject, GenerationInput, GenerationResult

logger = logging.getLogger("gaa_ai.api")

app = FastAPI(title="GAA AI Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalysisObject)
def analyze(inp: AnalysisInput) -> AnalysisObject:
    # Imported lazily so the module loads even before the pipeline is wired.
    from gaa_ai.pipeline import run_analysis

    try:
        return run_analysis(inp)
    except Exception as exc:  # noqa: BLE001 — surface a clean 502, log the cause
        logger.exception("analysis failed")
        raise HTTPException(status_code=502, detail=f"Analysis failed: {exc}") from exc


@app.post("/generate", response_model=GenerationResult)
def generate(inp: GenerationInput) -> GenerationResult:
    # Imported lazily so the module loads even before generation is wired.
    from gaa_ai.generation import generate_variants

    try:
        return generate_variants(inp)
    except Exception as exc:  # noqa: BLE001 — surface a clean 502, log the cause
        logger.exception("generation failed")
        raise HTTPException(status_code=502, detail=f"Generation failed: {exc}") from exc
