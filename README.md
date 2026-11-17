# Dhaba Orders — Production on Kubernetes

A seven-service restaurant ordering application plus an `ops-monitor` image:
React/Vite web, FastAPI menu API, Go orders API, Java/Spring kitchen worker,
Laravel stats API, PostgreSQL and Redis.

## Local development
Requirements: Docker + Docker Compose.

```bash
docker compose up --build
```
Open http://localhost:8080. The web container proxies `/api/menu`, `/api/orders`,
`/api/stats`, and `/api/orders/...` to the corresponding services. PostgreSQL and
Redis are internal-only. Demo database initialization runs automatically.

Useful endpoints:
- `GET /api/menu`
- `POST /api/orders` with `{"items":[{"dish_id":1,"quantity":2}]}`
- `GET /api/orders/{id}`
- `GET /api/stats`

## Kubernetes / CI
1. Replace `TEAM`, AWS account/region, hostnames and image registry placeholders.
2. Create Kubernetes Secrets from `k8s/examples/secrets.example.env`; do not commit real secrets.
3. Create ECR repositories with `scripts/create-ecr-repos.sh`.
4. Apply a Kustomize overlay: `kubectl apply -k k8s/overlays/staging`.
5. Configure GitHub repository secrets: `AWS_ROLE_ARN`, `AWS_REGION`, `ECR_REGISTRY`,
   `KUBE_CONFIG_STAGING`, `KUBE_CONFIG_PRODUCTION`, `SLACK_WEBHOOK_URL`.
6. Configure GitHub OIDC trust for the repository and a `production` Environment
   with required reviewers.
7. Set branch protection to require the CI workflow checks and one PR approval.

The workflow is a practical reference implementation. The cluster is outside AWS;
the included ECR refresh CronJob uses a short-lived AWS web-identity token mounted
from a Kubernetes ServiceAccount. This requires an AWS IAM OIDC provider/trust
configuration for the cluster's identity issuer and is intentionally not enabled
until your trainer supplies the issuer/role details. Do not put AWS keys in Git.

## Important deployment notes
- Staging and production each have their own PostgreSQL and Redis PVCs.
- PostgreSQL and Redis are ClusterIP-only; no NodePort/Ingress.
- `k8s/base` contains shared resources. Overlays set hostnames and replica counts.
- Set real secrets in the cluster before deploying.
- The included manifests are a learning baseline; validate against your cluster
  version and review resource sizing, network policies, backups, TLS and security
  before real customer use.
- GitHub-hosted runners need network access to the cluster ingress and Kubernetes
  API for deployment. Restrict the deploy ServiceAccount to staging/production.

## Team workflow
Branch and PR titles begin with the Jira issue key, e.g. `DHB-12-orders-retry`.
Every change goes through a PR. Do not push directly to `main`.
