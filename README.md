# Two-Tier Application — AWS ECS Fargate Deployment

> End-to-end containerized deployment using Docker, Amazon ECR, Amazon ECS, Application Load Balancer, and CI/CD with AWS CodePipeline + CodeBuild.

---

## Architecture

```
Browser
  └── ALB (port 80)
        ├── /api/*  ──► Backend ECS Service  (Node.js :5000)  [Private Subnet]
        └── /*      ──► Frontend ECS Service (Nginx :80)      [Public Subnet]
```

```
CI/CD Pipeline:
  GitHub Push ──► CodePipeline ──► CodeBuild ──► ECR ──► ECS Rolling Deploy
```

---

## Project Structure

```
two-tier-app/
├── backend/
│   ├── server.js              # Node.js Express API
│   ├── package.json           # Dependencies (express, cors)
│   └── Dockerfile             # public.ecr.aws/docker/library/node:18-alpine
├── frontend/
│   ├── index.html             # Static UI — calls /api/* endpoints
│   ├── nginx.conf             # Nginx config — proxies /api to BACKEND_HOST
│   ├── docker-entrypoint.sh   # Injects BACKEND_HOST env var at container start
│   └── Dockerfile             # public.ecr.aws/docker/library/nginx:alpine
├── docker-compose.yml         # Local two-tier testing
├── buildspec.yml              # CodeBuild pipeline (build + push + deploy)
├── .github/workflows/
│   └── deploy.yml             # GitHub Actions alternative to CodePipeline
└── README.md
```

---

## Prerequisites

- AWS Account + IAM user with required permissions
- Docker installed locally
- AWS CLI configured (`aws configure`)
- GitHub account

---

## Local Development

```bash
# Clone and run both tiers together
git clone https://github.com/YOUR_USERNAME/two-tier-app
cd two-tier-app
docker-compose up --build

# Frontend:  http://localhost
# Backend:   http://localhost:5000
# Health:    http://localhost/health
#            http://localhost:5000/health
```

---

## AWS Deployment Steps

### 1. Create ECR Repositories

```bash
export AWS_REGION=us-east-2
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws ecr create-repository --repository-name two-tier-backend  --region $AWS_REGION
aws ecr create-repository --repository-name two-tier-frontend --region $AWS_REGION
```

### 2. Build & Push Images

```bash
# Login
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Backend
docker build -t two-tier-backend ./backend
docker tag two-tier-backend:latest \
  $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/two-tier-backend:latest
docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/two-tier-backend:latest

# Frontend
docker build -t two-tier-frontend ./frontend
docker tag two-tier-frontend:latest \
  $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/two-tier-frontend:latest
docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/two-tier-frontend:latest
```

### 3. ECS Setup

| Resource | Value |
|---|---|
| Cluster | two-tier-cluster (Fargate) |
| Backend task | backend-task — container: `backend`, port: 5000 |
| Frontend task | frontend-task — container: `frontend`, port: 80 |
| ALB | two-tier-alb (internet-facing) |
| backend-tg | Target type: **IP**, port 5000, health path /health |
| frontend-tg | Target type: **IP**, port 80, health path /health |
| Listener rule 1 | Priority 1 — `/api/*` → backend-tg |
| Listener default | `/*` → frontend-tg |
| BACKEND_HOST | Set to ALB DNS name in frontend task env vars |

### 4. CI/CD Pipeline

```
CodePipeline stages:
  Source  → GitHub (main branch, auto-trigger on push)
  Build   → CodeBuild (buildspec.yml)
  Deploy  → ECS: deploy-backend + deploy-frontend (parallel)
```

**CodeBuild environment variables:**

| Variable | Value |
|---|---|
| AWS_ACCOUNT_ID | your-account-id |
| AWS_DEFAULT_REGION | us-east-2 |
| FRONTEND_REPO_NAME | two-tier-frontend |
| BACKEND_REPO_NAME | two-tier-backend |
| ECS_CLUSTER_NAME | two-tier-cluster |
| FRONTEND_SERVICE_NAME | frontend-service |
| BACKEND_SERVICE_NAME | backend-service |
| FRONTEND_TASK_DEF | frontend-task |
| BACKEND_TASK_DEF | backend-task |

**Required IAM policies on CodeBuild role:**
- `AmazonEC2ContainerRegistryFullAccess`
- `AmazonECS_FullAccess`
- Inline: `codeconnections:UseConnection`, `s3:PutObject` on pipeline bucket

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Frontend health check |
| `/api/health` | GET | Backend health check |
| `/api/status` | GET | Service info (version, uptime, region) |
| `/api/items` | GET | Sample product list |

---

## Environment Variables

**Backend container:**
- `NODE_ENV` — `production` (ECS) / `development` (local)
- `PORT` — API port, default `5000`

**Frontend container:**
- `BACKEND_HOST` — ALB DNS name (e.g. `two-tier-alb-xxx.us-east-2.elb.amazonaws.com`)

---

## Verify Deployment

```bash
# Get ALB DNS
aws elbv2 describe-load-balancers \
  --names two-tier-alb \
  --query 'LoadBalancers[0].DNSName' --output text

# Test all endpoints
curl http://<ALB-DNS>/
curl http://<ALB-DNS>/health
curl http://<ALB-DNS>/api/status
curl http://<ALB-DNS>/api/items
```

---

## Test CI/CD

```bash
# Make a change
# Edit backend/server.js — change version to 2.0.0

git add .
git commit -m "bump version to 2.0.0"
git push origin main

# Pipeline auto-triggers → new images built → ECS rolling update
# Verify: curl http://<ALB-DNS>/api/status → {"version":"2.0.0",...}
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Docker Hub 429 rate limit | Use `public.ecr.aws/docker/library/node:18-alpine` |
| ECR AccessDeniedException | Add `AmazonEC2ContainerRegistryFullAccess` to CodeBuild role |
| ECS container does not exist | Container name in `imagedefinitions_*.json` must match task definition exactly |
| Target group unhealthy | Recreate with **Target type: IP** (not Instance) |
| Frontend unhealthy locally | `docker system prune -af` then `docker-compose up --build` |
| Pipeline S3 AccessDenied | Add `s3:PutObject` to CodePipeline service role |
| CodeConnections AccessDenied | Add `codeconnections:UseConnection` to both CodePipeline and CodeBuild roles |

---

## Bonus Tasks

- **Auto Scaling** — ECS service auto scaling: min 1, max 4, CPU > 70%
- **HTTPS** — ACM certificate on ALB port 443
- **Secrets Manager** — Store env vars securely
- **CloudWatch Alarms** — Alert on CPU/memory or ALB 5xx errors

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Nginx (static HTML) |
| Backend | Node.js + Express |
| Containerization | Docker |
| Registry | Amazon ECR |
| Orchestration | Amazon ECS Fargate |
| Load Balancer | AWS ALB (path-based routing) |
| CI/CD | AWS CodePipeline + CodeBuild |
| Logs | Amazon CloudWatch |
| Network | AWS VPC (public + private subnets) |
