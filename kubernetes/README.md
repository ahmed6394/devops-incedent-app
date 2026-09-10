# Kubernetes Lab

Deploy the incident management stack on a local KinD cluster.

## Architecture

```
Frontend (LoadBalancer:80) → Backend (ClusterIP:5000) → PostgreSQL (ClusterIP:5432)
```

All resources run in `my-namespace`.

## Prerequisites

- Docker
- KinD (v0.29+)
- kubectl

## Quick start

1. Create the cluster

   ```bash
   kind create cluster --config kind-config.yaml
   ```

2. Create namespace and database secret

   ```bash
   kubectl apply -f namespace.yaml
   kubectl create secret generic db-credentials \
     --from-literal=username=<your-username> \
     --from-literal=password=<your-password> \
     -n my-namespace
   ```

3. Deploy the stack

   ```bash
   kubectl apply -f database-deployment.yaml -f database-service.yaml
   kubectl apply -f backend-deployment.yaml -f backend-service.yaml
   kubectl apply -f frontend-deployment.yaml -f frontend-service.yaml
   ```

4. Verify

   ```bash
   kubectl get pods,svc,endpoints -n my-namespace
   ```

## Environment

| Variable | Description |
|----------|-------------|
| DB_USER | PostgreSQL username (must match secret) |
| DB_PASSWORD | PostgreSQL password (stored in db-credentials secret) |
| DB_NAME | Database name (default: incidentdb) |

## Troubleshooting

- **Backend CrashLoopBackOff** → check database pod is running and secret exists
- **Frontend no endpoints** → verify service selector matches pod labels
- **LoadBalancer unreachable** → confirm kind-config.yaml has extraPortMappings for port 80

For full step-by-step instructions, see [k8s-instructions.md](k8s-instructions.md).
