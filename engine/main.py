"""
FastAPI gateway for the NZEB retrofit decision engine.

Exposed as tools to the Next.js Agent Harness:
  POST /optimize    - run NSGA-III, return Pareto set + recommended design
  POST /evaluate    - score a single retrofit design (3 objectives + breakdown)
  POST /compliance  - QCVN 09:2017 + LEED v5 BD+C verdict for a design
  POST /explain     - XAI attribution + sensitivity for a design
  GET  /health
"""

from __future__ import annotations
from typing import Dict, List, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from surrogate import Building, evaluate, MEASURE_KEYS
from optimize import run_nsga3
from compliance import assess
from xai import explain

app = FastAPI(title="NZEB Retrofit Decision Engine", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


class BuildingIn(BaseModel):
    btype: str = "office"
    year_built: int = 1998
    area: float = 2500
    floors: int = 8
    eui_base: float = 180
    u_wall: float = 1.8
    budget: float = 500000


class DesignIn(BuildingIn):
    x: List[float] = Field(default_factory=lambda: [0.0] * len(MEASURE_KEYS))


class OptimizeIn(BuildingIn):
    pop_size: int = 92
    n_gen: int = 60


def _to_building(b: BuildingIn) -> Building:
    return Building(
        btype=b.btype, year_built=b.year_built, area=b.area, floors=b.floors,
        eui_base=b.eui_base, u_wall=b.u_wall, budget=b.budget,
    )


@app.get("/health")
def health():
    return {"status": "ok", "measures": MEASURE_KEYS}


@app.post("/optimize")
def optimize(inp: OptimizeIn):
    b = _to_building(inp)
    result = run_nsga3(b, pop_size=inp.pop_size, n_gen=inp.n_gen)
    rec = result["solutions"][result["recommended_index"]]
    x_rec = [rec["x"][k] for k in MEASURE_KEYS]
    result["recommended"] = {
        "design": rec,
        "compliance": assess(b, x_rec, rec["f1_eui"]),
        "xai": explain(b, x_rec),
    }
    return result


@app.post("/evaluate")
def evaluate_design(inp: DesignIn):
    b = _to_building(inp)
    return evaluate(b, inp.x)


@app.post("/compliance")
def compliance(inp: DesignIn):
    b = _to_building(inp)
    ev = evaluate(b, inp.x)
    return assess(b, inp.x, ev["f1_eui"])


@app.post("/explain")
def explain_design(inp: DesignIn):
    b = _to_building(inp)
    return explain(b, inp.x)
