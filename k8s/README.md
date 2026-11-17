Before apply:
1. Replace TEAM and ECR placeholders in both overlays.
2. Create namespaces and secrets in each environment:
   `kubectl create namespace staging`
   `kubectl create secret generic dhaba-secrets --from-env-file=secrets.env -n staging`
   Repeat for production. The secret file must contain `postgres-password` and `app-key`.
3. Apply `kubectl apply -k k8s/overlays/staging` and production separately.

PostgreSQL init SQL is mounted from a ConfigMap and runs only when its data
directory is first initialized. StatefulSet PVCs retain database files across pod
restarts. Production replicas are set to two for stateless Deployments; review
anti-affinity for the worker and ensure enough schedulable nodes.

This is a bootcamp reference implementation, not a security-reviewed production
platform. Add TLS, backups/restore tests, NetworkPolicies, resource tuning,
PodDisruptionBudgets validated against desired replica counts, and proper
least-privilege RBAC before real customer traffic.
