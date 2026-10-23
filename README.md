# AWS Exam Simulator

A practice-exam app for AWS certifications. Pick the exam from a dropdown, upload a CSV question set, and sit it under exam conditions: a countdown clock, 65 questions, 50 of them scored. Every attempt (seed, answers, score) is saved to a local JSON file.

## Run it

Needs Node 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173
```

For a production build: `npm run build && npm start`.

`npm test` runs the logic tests (CSV parsing, seeded selection, grading).

## How an exam works

1. **Choose the certification.** The dropdown sets the time limit and passing score (see `src/lib/certs.js`; edit the values there if an exam guide changes them).
2. **Upload the CSV.** The app validates every row and tells you which ones it skipped and why. You need at least 50 valid questions. With more than 65, the seed picks 65.
3. **Seed.** A random seed is pre-filled (type your own if you like). The seed decides the question order and which 50 questions are scored. The same seed with the same file always gives the identical exam. Which questions are scored is hidden during the exam and shown in the review afterwards.
4. **Sit the exam.** A countdown timer runs against an absolute end time and can't be paused; at zero the exam ends and is scored. You can flag questions, jump around using the answer sheet, and use Review to see what's unanswered. Multiple-response questions show "Choose N". Refreshing the page resumes the exam in progress.
5. **Results.** Estimated scaled score (100 to 1000), pass or not yet, score by domain (if your CSV has a `domain` column), and a question-by-question review with explanations.
6. **History.** Every attempt, with best/average score, pass rate and the questions you miss most. "Replay seed" sets up the identical exam again (the app warns if you upload a different file).

## CSV format

Column order doesn't matter; header names are flexible.

| Column | Required | Notes |
| --- | --- | --- |
| `question` | yes | Question text. Quote it if it contains commas or line breaks. |
| `option_a` … `option_j` | at least two | Also accepted: `a`, `b`, `choice_a`, `option1`. Blank cells are ignored. |
| `answer` | yes | `B` for single answer, `A,C` for multiple response. |
| `id` | no | Unique id per question. Defaults to `Q1`, `Q2`, … |
| `domain` | no | Enables the per-domain breakdown. |
| `explanation` | no | Shown in the review. |

```csv
id,domain,question,option_a,option_b,option_c,option_d,option_e,answer,explanation
1,Security,"Which service controls access to AWS resources?",IAM,S3,EC2,VPC,,A,"IAM manages access."
2,Storage,"Which TWO are storage services? (Choose two.)",S3,EBS,Lambda,SNS,EFS,"A,B","..."
```

`public/sample-exam.csv` is a 65-question demo set in this format (regenerate with `npm run make-sample`). It exists to try the app; use your own question set for real practice. The seed-to-exam mapping depends on the file's content and row order, so keep your file stable if you want to replay a seed.

## Scoring

- Only the 50 scored questions count. The other 15 are tracked but ignored, as on the real exam.
- Multiple-response questions are all-or-nothing.
- Scaled score = `100 + 900 × (scored correct ÷ 50)`. AWS doesn't publish its real scaling, so this is a straight-line estimate. Treat it as a guide, not a prediction.

## Where the data lives

`data/db.json`, created on the first saved attempt. Override the location with `DB_PATH=/some/where/db.json npm run dev`. The server binds to `127.0.0.1` only. Writes are atomic (temp file, then rename), and if `db.json` is ever corrupt the server refuses to overwrite it.

Each attempt stores: id, timestamps, certification, CSV name and fingerprint, seed, score, pass/fail, time used, domain breakdown, and for every question its position, whether it was scored, text, options, correct answer, your answer, correctness, whether you flagged it, and seconds spent on it.

API (used by the UI): `GET /api/attempts`, `POST /api/attempts`, `DELETE /api/attempts/:id`, `GET /api/export`.

## Project layout

```
server/index.js        Express: JSON database API + Vite dev server / static build
src/lib/rng.js         seeded PRNG and shuffle
src/lib/csv.js         CSV parser and question-bank validation
src/lib/exam.js        exam builder (seeded selection), grading, attempt records
src/lib/certs.js       certification dropdown data
src/components/        Setup, Exam, Results, Review, History
tests/logic.test.mjs   unit tests
```
