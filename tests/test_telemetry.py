import json
import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from core.telemetry import TelemetryMiddleware

app = FastAPI()
app.add_middleware(TelemetryMiddleware)

@app.get("/success")
async def success():
    return {"message": "ok"}

@app.get("/error")
async def error():
    raise ValueError("Something went wrong")

@app.get("/client-error")
async def client_error(request: Request):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=400, content={"message": "bad request"})

client = TestClient(app)

def test_telemetry_success(caplog):
    import logging
    # Temporarily remove handlers to allow caplog to capture
    logger = logging.getLogger("ontology_explorer")
    old_handlers = logger.handlers
    logger.handlers = []
    
    with caplog.at_level(logging.INFO, logger="ontology_explorer"):
        response = client.get("/success")
        assert response.status_code == 200
        
    logger.handlers = old_handlers
    
    log_records = [r for r in caplog.records if r.name == "ontology_explorer"]
    assert len(log_records) == 1
    log_data = json.loads(log_records[0].message)
    assert log_data["operation"] == "GET /success"
    assert log_data["status_code"] == 200
    assert "duration_ms" in log_data
    assert "stable_error_code" not in log_data

def test_telemetry_server_error(caplog):
    import logging
    logger = logging.getLogger("ontology_explorer")
    old_handlers = logger.handlers
    logger.handlers = []
    
    with pytest.raises(ValueError):
        with caplog.at_level(logging.INFO, logger="ontology_explorer"):
            client.get("/error")
            
    logger.handlers = old_handlers
            
    log_records = [r for r in caplog.records if r.name == "ontology_explorer"]
    assert len(log_records) == 1
    log_data = json.loads(log_records[0].message)
    assert log_data["operation"] == "GET /error"
    assert log_data["status_code"] == 500
    assert log_data["error"] == "ValueError"
    assert log_data["stable_error_code"] == "INTERNAL_SERVER_ERROR"

def test_telemetry_client_error(caplog):
    import logging
    logger = logging.getLogger("ontology_explorer")
    old_handlers = logger.handlers
    logger.handlers = []
    
    with caplog.at_level(logging.INFO, logger="ontology_explorer"):
        response = client.get("/client-error")
        assert response.status_code == 400
        
    logger.handlers = old_handlers
        
    log_records = [r for r in caplog.records if r.name == "ontology_explorer"]
    assert len(log_records) == 1
    log_data = json.loads(log_records[0].message)
    assert log_data["operation"] == "GET /client-error"
    assert log_data["status_code"] == 400
    assert log_data["stable_error_code"] == "BAD_REQUEST"
