import pytest
from server.api.routes.style_comparison import calculate_euclidean_distance, generate_radar_chart_data


@pytest.mark.asyncio
async def test_calculate_euclidean_distance_identical() -> None:
    """Test distance between identical vectors."""
    vec1 = {"tone": 0.8, "formality": 0.6}
    vec2 = {"tone": 0.8, "formality": 0.6}

    distance = calculate_euclidean_distance(vec1, vec2)
    assert distance == 0.0


@pytest.mark.asyncio
async def test_calculate_euclidean_distance_different() -> None:
    """Test distance between different vectors."""
    vec1 = {"tone": 0.8, "formality": 0.6}
    vec2 = {"tone": 0.4, "formality": 0.2}

    distance = calculate_euclidean_distance(vec1, vec2)
    assert 0 < distance < 1


@pytest.mark.asyncio
async def test_generate_radar_chart_data() -> None:
    """Test radar chart data generation."""
    vec1 = {"tone": 0.8, "formality": 0.6}
    vec2 = {"tone": 0.4, "formality": 0.2}

    data = generate_radar_chart_data(vec1, vec2)

    assert "labels" in data
    assert "values_1" in data
    assert "values_2" in data
    assert data["labels"] == ["formality", "tone"]
    assert len(data["values_1"]) == 2
    assert len(data["values_2"]) == 2
