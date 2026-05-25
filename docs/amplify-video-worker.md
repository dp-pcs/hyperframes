# Amplify Video Worker

This worker is the render backend for Amplify explainer-video jobs.

It runs as a dedicated ECS Fargate service and pulls jobs from SQS, then:

- reads the Amplify `source.json`, `brief.json`, and `plan.json` artifacts
- generates narration/script cards
- synthesizes voiceover with ElevenLabs when enabled
- renders the MP4 through Hyperframes
- uploads artifacts back to the Amplify assets bucket
- updates the Amplify DynamoDB job record

## AWS targets

- Account: `913524910742`
- Region: `us-east-1`
- ECS cluster: `amplify-dev-cluster`
- ECS service: `amplify-dev-video-worker`
- Task definition family: `amplify-dev-video-worker`
- Queue: `amplify-dev-explainer-video-jobs`
- DLQ: `amplify-dev-explainer-video-jobs-dlq`
- ECR repo: `amplify/dev/video-worker`
- CloudWatch log group: `/ecs/amplify-dev-video-worker`

## Runtime config

- `AMPLIFY_VIDEO_QUEUE_URL`
- `DYNAMODB_TABLE_NAME`
- `AWS_REGION`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- optional: `ELEVENLABS_MODEL_ID`
- optional: `WORKER_POLL_WAIT_SECONDS`
- optional: `WORKER_VISIBILITY_TIMEOUT_SECONDS`
- optional: `HYPERFRAMES_RENDER_WORKERS`

## Deploy

Use:

```bash
scripts/deploy-amplify-worker.sh
```

That script builds `Dockerfile.amplify-worker` for `linux/amd64` and pushes both
`latest` and the current git-sha tag to the Amplify ECR repo.
