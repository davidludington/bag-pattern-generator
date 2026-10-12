import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

import api

SPEC = {
    "type": "tote",
    "dimensions": {"width": 300, "height": 250, "depth": 100},
    "construction": {"seamAllowance": 10},
    "handles": {"length": 600, "width": 30, "placement": 60},
}


def test_spec_to_config_maps_camel_case_to_yaml_shape():
    cfg = api.spec_to_config(SPEC)
    assert cfg["bag"] == {"width": 300, "height": 250, "depth": 100}
    assert cfg["construction"]["seam_allowance"] == 10
    assert cfg["handles"] == {"length": 600, "width": 30, "inset": 60}


def test_build_pattern_returns_pieces_with_identity():
    pattern = api.build_pattern(SPEC)
    assert pattern["sheet"]["width"] > 0 and pattern["sheet"]["height"] > 0
    ids = [p["id"] for p in pattern["pieces"]]
    assert ids == ["front", "back", "gusset", "handle-1", "handle-2"]
    front = pattern["pieces"][0]
    assert front["finished"] == [300, 250]
    assert front["cutSize"] == [320, 270]
    assert front["transform"]["x"] >= 0 and front["transform"]["y"] >= 0
    # cut ring is closed-shape sized correctly
    xs = [x for x, _ in front["cut"]]
    ys = [y for _, y in front["cut"]]
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
        api.spec_to_config({**SPEC, "type": "backpack"})
    with pytest.raises(ValueError):
        api.spec_to_config({**SPEC, "dimensions": {"width": 300}})
    bad = {**SPEC, "handles": {"length": 600, "width": 30, "placement": 500}}
    with pytest.raises(ValueError):
        api.build_pattern(bad)
    with pytest.raises(ValueError):
        api.build_pattern({**SPEC, "construction": {"seamAllowance": -5}})


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
