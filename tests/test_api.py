import json
import os
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

import api
import infer
from infer import InferenceError, infer_bag

SPEC = {
    "type": "tote",
    "seamAllowance": 10,
    "parameters": {
        "width": 300,
        "height": 250,
        "depth": 100,
        "handle_length": 600,
        "handle_width": 30,
        "handle_inset": 60,
    },
}

IMAGE = "data:image/jpeg;base64,AAA="


def test_load_env_reads_dotenv_without_clobbering(tmp_path, monkeypatch):
    path = tmp_path / ".env"
    path.write_text(
        "# comment\n\nOPENAI_API_KEY=sk-from-file\nQUOTED='single quoted'\n"
        "EXISTING=from-file\n"
    )
    monkeypatch.setenv("EXISTING", "from-shell")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("QUOTED", raising=False)
    api.load_env(path)
    assert os.environ["OPENAI_API_KEY"] == "sk-from-file"
    assert os.environ["QUOTED"] == "single quoted"
    assert os.environ["EXISTING"] == "from-shell"
    api.load_env(tmp_path / "absent.env")  # missing file is not an error


def test_types_schema_lists_generators():
    types = api.schemas()
    tote = next(t for t in types if t["type"] == "tote")
    assert tote["label"]
    keys = [f["key"] for s in tote["sections"] for f in s["fields"]]
    assert "width" in keys and "handle_length" in keys
    assert tote["sections"][0]["fields"][0]["default"] == 300


def test_resolve_fills_defaults_and_shared_params():
    gen = api.get("tote")
    params = gen.resolve({"width": 200, "seam_allowance": 0, "name": "small"})
    assert params["width"] == 200
    assert params["height"] == 250  # schema default
    assert params["seam_allowance"] == 0
    assert params["name"] == "small"


def test_build_pattern_returns_pieces_with_identity():
    pattern = api.build_pattern(SPEC)
    assert pattern["sheet"]["width"] > 0 and pattern["sheet"]["height"] > 0
    ids = [p["id"] for p in pattern["pieces"]]
    assert ids == ["front", "back", "gusset", "handle-1", "handle-2"]
    front = pattern["pieces"][0]
    assert front["finished"] == [300, 250]
    assert front["cutSize"] == [320, 270]
    assert front["transform"]["x"] >= 0 and front["transform"]["y"] >= 0
    xs = [x for x, _ in front["cut"]]
    assert max(xs) - min(xs) == 320
    gusset = pattern["pieces"][2]
    assert gusset["finished"] == [800, 100]


def test_build_svg_is_printable_sheet():
    svg = api.build_svg(SPEC)
    assert svg.startswith("<?xml")
    assert 'width="' in svg and 'mm"' in svg
    assert 'data-piece="front"' in svg
    assert "100 mm" in svg


def test_invalid_specs_raise_value_error():
    with pytest.raises(ValueError):
        api.build_pattern({**SPEC, "type": "backpack"})
    with pytest.raises(ValueError):
        api.build_pattern(
            {**SPEC, "parameters": {**SPEC["parameters"], "nope": 1}}
        )
    bad = {**SPEC, "parameters": {**SPEC["parameters"], "handle_inset": 500}}
    with pytest.raises(ValueError):
        api.build_pattern(bad)
    with pytest.raises(ValueError):
        api.build_pattern({**SPEC, "seamAllowance": -5})


def _post(port: int, path: str, spec: dict):
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=json.dumps(spec).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return urllib.request.urlopen(req)


def test_http_round_trip():
    server = ThreadingHTTPServer(("127.0.0.1", 0), api.Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/types") as res:
            assert res.status == 200
            assert any(t["type"] == "tote" for t in json.load(res)["types"])

        with _post(port, "/api/pattern", SPEC) as res:
            assert res.status == 200
            pattern = json.load(res)
        assert len(pattern["pieces"]) == 5

        with _post(port, "/api/export.svg", SPEC) as res:
            assert res.status == 200
            assert res.headers["Content-Type"] == "image/svg+xml"
            assert b"data-piece" in res.read()

        with pytest.raises(urllib.error.HTTPError) as err:
            _post(port, "/api/pattern", {**SPEC, "type": "backpack"})
        assert err.value.code == 400
        assert "error" in json.load(err.value)

        with pytest.raises(urllib.error.HTTPError) as err:
            _post(port, "/api/nope", SPEC)
        assert err.value.code == 404
    finally:
        server.shutdown()


def test_infer_requires_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(InferenceError, match="OPENAI_API_KEY"):
        infer_bag(IMAGE)
    with pytest.raises(ValueError):
        infer_bag("not an image")


def test_infer_maps_model_reply_onto_schema(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(
        infer,
        "_chat",
        lambda key, image, prompt: {
            "type": "tote",
            "parameters": {"width": "420", "nonsense": 3, "seam_allowance": 99},
        },
    )
    spec = infer_bag(IMAGE)
    assert spec["type"] == "tote"
    params = spec["parameters"]
    assert params["width"] == 420  # coerced to float
    assert params["height"] == 250  # schema default fills the rest
    assert "nonsense" not in params and "seam_allowance" not in params
    assert all(isinstance(v, (int, float)) for v in params.values())


def test_infer_rejects_unknown_bag_type(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(
        infer, "_chat", lambda key, image, prompt: {"type": "duffel", "parameters": {}}
    )
    with pytest.raises(InferenceError, match="unknown bag type"):
        infer_bag(IMAGE)


def test_infer_retries_then_falls_back_to_default_dimensions(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    calls = []
    monkeypatch.setattr(
        infer,
        "_chat",
        lambda key, image, prompt: (
            calls.append(prompt),
            {"type": "tote", "parameters": {"width": 100}},
        )[1],
    )
    spec = infer_bag(IMAGE)  # width 100 with the default inset violates the fit rule
    assert spec["type"] == "tote"
    assert spec["parameters"]["width"] == 300  # defaults, not the rejected 100
    assert len(calls) == 2 and "rejected" in calls[1]


def test_infer_route_reports_errors_as_json(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    server = ThreadingHTTPServer(("127.0.0.1", 0), api.Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    try:
        with pytest.raises(urllib.error.HTTPError) as err:
            _post(port, "/api/infer", {"image": IMAGE})
        assert err.value.code == 502
        assert "OPENAI_API_KEY" in json.load(err.value)["error"]

        with pytest.raises(urllib.error.HTTPError) as err:
            _post(port, "/api/infer", {"image": "nope"})
        assert err.value.code == 400
    finally:
        server.shutdown()
