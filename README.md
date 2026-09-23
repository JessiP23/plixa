# Plixa

Automated floor-plan review for architecture and design-build studios.

The previous product in `pixa` split perception, a compliance kernel, and a Next.js cockpit across Python services. This repo keeps that split, and runs the part that can live on Vercel: the studio, the intermediate representation, and the deterministic IRC kernel.

## Run it

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then Studio.

Studio starts with two reviews:

- **Cedar Court Residence** is a small orthogonal plan with known failures, including an undersized bedroom and a stair riser over 7.75 inches.
- **Captured sheet 225** is a real IR emitted by the Pixa perception pipeline.

You can also upload your own IR JSON. The kernel is the only thing that emits pass, fail, or inconclusive.

## What replaced the AWS sketch

| Before | Here |
| --- | --- |
| Cognito JWT | Supabase Auth, when you apply `supabase/migrations/0001_studio.sql` |
| S3 presigned upload | Supabase Storage bucket `plans`, private, keyed by org and project |
| DynamoDB | Postgres tables `organizations`, `memberships`, `projects` |
| EventBridge | The review route runs perception lookup and the kernel in one job. A worker URL can sit in front later. |
| OpenSearch | Postgres search, and the studio search box, always filtered by `org_id` |
| Lambda + FastAPI | Next.js route handlers on Vercel |

Until those Supabase environment variables exist, reviews persist in `.data/studio.json` on this machine, still scoped to the demo org `org_northline`.

Image perception (CubiCasa and the OCR step) stays in the Python worker from `pixa`. Vercel cannot host that model. Point a future worker at `POST /api/projects` with `source: "uploaded-ir"`.

The IRC 2021 pack is loaded as data and is marked pending human certification. Plixa does not issue permits.
