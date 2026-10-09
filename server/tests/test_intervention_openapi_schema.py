"""Regression coverage for the raw intervention response serialization schema."""

import json
from datetime import datetime

import pytest
from pydantic import ValidationError

from server.api.main import app
from server.domain.models.anchor import AnchorLockId, AnchorPos, AnchorRange
from server.domain.models.intervention import InterventionResponse


def test_openapi_intervention_response_requires_serialized_defaults() -> None:
    """Describe emitted defaults as required without changing input validation."""
    anchors = [
        AnchorPos.model_validate({"from": 12}),
        AnchorRange.model_validate({"from": 12, "to": 24}),
        AnchorLockId.model_validate({"ref_lock_id": "lock_existing"}),
    ]
    assert [anchor.type for anchor in anchors] == ["pos", "range", "lock_id"]
    assert "issued_at" not in InterventionResponse.model_json_schema(mode="validation")["required"]

    serialized = []
    for anchor in anchors:
        anchor_model = type(anchor)
        assert "type" not in anchor_model.model_json_schema(mode="validation")["required"]
        with pytest.raises(ValidationError):
            anchor_model.model_validate({**anchor.model_dump(by_alias=True), "type": "invalid"})

        # Defaulted fields are omitted from input, as existing model callers allow.
        response = InterventionResponse.model_validate(
            {
                "action": "provoke",
                "content": "A door opens behind the narrator.",
                "lock_id": "lock_schema_regression",
                "anchor": anchor,
                "action_id": "act_schema_regression",
                "source": "muse",
            }
        )
        payload = json.loads(response.model_dump_json(by_alias=True))
        assert isinstance(response.issued_at, datetime)
        assert datetime.fromisoformat(payload["issued_at"]) == response.issued_at
        assert payload["anchor"] == anchor.model_dump(mode="json", by_alias=True)
        serialized.append(payload)

    # Resolve the actual endpoint response and union references directly; do not
    # import the client generator or normalize any OpenAPI required lists.
    openapi = app.openapi()
    schemas = openapi["components"]["schemas"]
    response_ref = openapi["paths"]["/impetus/generate-intervention"]["post"]["responses"]["200"][
        "content"
    ]["application/json"]["schema"]["$ref"]
    response_name = response_ref.rsplit("/", 1)[-1]
    response_schema = schemas[response_name]
    required = {response_name: response_schema.get("required", [])}
    missing = []
    if "issued_at" not in required[response_name]:
        missing.append(f"{response_name}.issued_at")
    for variant in response_schema["properties"]["anchor"]["anyOf"]:
        anchor_name = variant["$ref"].rsplit("/", 1)[-1]
        required[anchor_name] = schemas[anchor_name].get("required", [])
        if "type" not in required[anchor_name]:
            missing.append(f"{anchor_name}.type")

    assert not missing, json.dumps(
        {
            "missing_required_serialized_fields": missing,
            "raw_openapi_required": required,
            "actual_serialized_responses": serialized,
            "validation_defaults_and_invalid_discriminant_checks": "passed",
        },
        indent=2,
    )
