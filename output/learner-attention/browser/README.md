# Isolated browser QA

From the repo root:

```sh
node output/learner-attention/browser/build.mjs
python3 output/learner-attention/browser/serve.py
```

Open `http://127.0.0.1:4318/en/dashboard/teacher/classes/00000000-0000-4000-8000-000000000001?classTab=analytics&attentionDays=90` in your own Ego Lite space. All records are synthetic. The harness uses production React components, CSS, theme variables and Inter, with simulated Next navigation and server actions. No Supabase credentials or connections. Do not interpret this as live backend acceptance.

Report URLs support `fixture=unavailable` (first read fails; retry recovers), `forbidden`, `partial` (optional study-plan evidence unavailable), or `empty`. The small QA toolbar toggles light/dark. Use the actual report selectors to switch language, learner or report month. Assignment/review links test destinations only.

Compiled JS/CSS/HTML are ignored. Matrix, interaction readback, screenshot evidence and the harness source are retained for review.
