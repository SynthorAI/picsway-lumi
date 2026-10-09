# PicSway Lumi V11 UI — Deployment

## Backend expected
- API: `POST https://i0cae18igk.execute-api.us-east-2.amazonaws.com/chat`
- Lambda: V11.1 option-authoritative response contract
- Frontend renders the backend `ui` object directly.

## Local verification
```bash
npm ci
npm run typecheck
npm run build
```

## GitHub Actions deployment
The included workflow deploys on every push to `main`:
1. npm ci
2. TypeScript check
3. Vite build
4. GitHub OIDC → AWS
5. `dist/` → `s3://picsway-lumi-frontend`
6. CloudFront invalidation for `EJ3E2NR0RPKBH`

GitHub repository secret required:
- `AWS_ROLE_ARN` = ARN of IAM role `picsway-lumi-github-deploy`

## Manual S3 test deployment
Upload the **contents** of `dist/` to the root of `picsway-lumi-frontend`, not the `dist` folder itself.
Then create CloudFront invalidation `/*` on distribution `EJ3E2NR0RPKBH`.
