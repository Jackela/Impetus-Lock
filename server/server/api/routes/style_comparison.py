"""Style Comparison API - Compare two style vectors."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/style/compare", tags=["style-comparison"])


class StyleComparisonRequest(BaseModel):
    """Request model for style comparison."""

    style_vector_1: dict[str, Any] = Field(..., description="First style vector")
    style_vector_2: dict[str, Any] = Field(..., description="Second style vector")


class StyleComparisonResponse(BaseModel):
    """Response model for style comparison."""

    euclidean_distance: float
    radar_chart_data: dict[str, list[float]]
    insights: str


def calculate_euclidean_distance(vec1: dict[str, Any], vec2: dict[str, Any]) -> float:
    """Calculate Euclidean distance between two style vectors."""
    common_keys = set(vec1.keys()) & set(vec2.keys())
    if not common_keys:
        return 1.0

    sum_squared = sum(
        (vec1[k] - vec2[k]) ** 2
        for k in common_keys
        if isinstance(vec1[k], (int, float)) and isinstance(vec2[k], (int, float))
    )
    return (sum_squared**0.5) / len(common_keys)


def generate_radar_chart_data(vec1: dict[str, Any], vec2: dict[str, Any]) -> dict[str, list[float]]:
    """Generate data for radar chart visualization."""
    common_keys = sorted(set(vec1.keys()) & set(vec2.keys()))

    return {
        "labels": common_keys,
        "values_1": [vec1.get(k, 0) for k in common_keys],
        "values_2": [vec2.get(k, 0) for k in common_keys],
    }


def generate_insights(distance: float, vec1: dict[str, Any], vec2: dict[str, Any]) -> str:
    """Generate comparison insights text."""
    if distance < 0.2:
        return "The styles are very similar. Both texts share similar tone and structure."
    elif distance < 0.5:
        return (
            "The styles have moderate differences. Some aspects differ while others remain similar."
        )
    else:
        return "The styles are quite different. Significant variations in tone, formality, or structure detected."


@router.post("", response_model=StyleComparisonResponse)
async def compare_styles(request: StyleComparisonRequest) -> StyleComparisonResponse:
    """Compare two style vectors and return differences.

    Args:
        request: Two style vectors to compare

    Returns:
        Comparison metrics, radar chart data, and insights
    """
    distance = calculate_euclidean_distance(request.style_vector_1, request.style_vector_2)
    radar_data = generate_radar_chart_data(request.style_vector_1, request.style_vector_2)
    insights = generate_insights(distance, request.style_vector_1, request.style_vector_2)

    return StyleComparisonResponse(
        euclidean_distance=round(distance, 4),
        radar_chart_data=radar_data,
        insights=insights,
    )
