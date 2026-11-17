# Ops monitor image

Build from the repository root so the Dockerfile can copy `scripts/monitor`:

```bash
docker build -f ops-monitor/Dockerfile -t dhaba-ops-monitor .
```

The monitor expects Kubernetes credentials/configuration and access to the target
cluster. It is intentionally not started by the local `docker compose up` stack.
