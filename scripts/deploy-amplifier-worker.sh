#!/usr/bin/env bash
# deploy-amplifier-worker.sh — build, push, and roll out the amplifier
# video worker to amplifier-dev ECS.
#
# Usage:
#   ./scripts/deploy-amplifier-worker.sh                  # full deploy
#   SKIP_DEPLOY=1 ./scripts/deploy-amplifier-worker.sh    # build + push only
#   SKIP_WAIT=1 ./scripts/deploy-amplifier-worker.sh      # don't wait for stable
#
# Env overrides: AWS_PROFILE, AWS_REGION, AWS_ACCOUNT, ECR_REPO, IMAGE_TAG,
# ECS_CLUSTER, ECS_SERVICE.

set -euo pipefail

AWS_PROFILE="${AWS_PROFILE:-prod-aicoe-admin}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT="${AWS_ACCOUNT:-913524910742}"
ECR_REPO="${ECR_REPO:-$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/amplifier/dev/video-worker}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
ECS_CLUSTER="${ECS_CLUSTER:-amplifier-dev-cluster}"
ECS_SERVICE="${ECS_SERVICE:-amplifier-dev-video-worker}"
SKIP_DEPLOY="${SKIP_DEPLOY:-0}"
SKIP_WAIT="${SKIP_WAIT:-0}"

echo "🔐 Logging into ECR ($AWS_ACCOUNT, $AWS_REGION, profile=$AWS_PROFILE)..."
aws --profile "$AWS_PROFILE" ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "🐳 Building $ECR_REPO:$IMAGE_TAG (linux/amd64)..."
docker buildx build \
  --platform linux/amd64 \
  -f Dockerfile.amplifier-worker \
  -t "$ECR_REPO:latest" \
  -t "$ECR_REPO:$IMAGE_TAG" \
  --push \
  .

echo "📤 Pushed:"
echo "    $ECR_REPO:latest"
echo "    $ECR_REPO:$IMAGE_TAG"

if [[ "$SKIP_DEPLOY" == "1" ]]; then
  echo "⏭  SKIP_DEPLOY=1 — stopping before ECS rollout."
  exit 0
fi

echo "🚀 Forcing new deployment on $ECS_CLUSTER/$ECS_SERVICE..."
aws ecs update-service \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --force-new-deployment \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --query 'service.{status:status,running:runningCount,desired:desiredCount}' \
  --output table

if [[ "$SKIP_WAIT" == "1" ]]; then
  echo "⏭  SKIP_WAIT=1 — rollout in flight; not waiting for stable."
  echo "✅ Deploy initiated."
  exit 0
fi

echo "⏳ Waiting for service to stabilize (this typically takes 3–8 minutes)..."
aws ecs wait services-stable \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION"

echo "✅ Deploy complete — $ECS_SERVICE is running $IMAGE_TAG."
