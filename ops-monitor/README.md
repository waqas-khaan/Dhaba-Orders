# Ops monitor image

Build from the repository root so the Dockerfile can copy `scripts/monitor`:

```bash
docker build -f ops-monitor/Dockerfile -t dhaba-ops-monitor .
```

The monitor periodically runs the health verification scripts:
- `check-cluster.sh`: Verifies node status, pod states, warning events, and persistent volumes.
- `check-services.sh`: Queries endpoints (`/health`, `/api/menu`, `/api/stats`) and outputs structured JSON telemetry records.
- `check-databases.sh`: Verifies PostgreSQL readiness and Redis connectivity via `redis-cli ping`.

The monitor expects Kubernetes credentials/configuration and access to the target
cluster. It is intentionally not started by the local `docker compose up` stack.
