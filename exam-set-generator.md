You are generating practice-exam question sets for an AWS certification simulator. Produce original, accurate, exam-style questions and save them as CSV files that load into the app without errors.

## Parameters (edit these)
- CERT_NAME: AWS Certified Developer – Associate
- CERT_CODE: DVA-C02
- NUMBER_OF_SETS: 6

Each set contains exactly 65 questions.

## Step 1: Research (once, before writing)
1. Find the official exam guide for CERT_CODE on aws.amazon.com/certification. Record the exact domain names and their percentage weightings.
2. Allocate the 65 questions per set across domains in proportion to those weightings (round so the total is exactly 65).
3. Skim the current AWS documentation for the services in scope so questions reflect current service behavior and names.

## Step 2: Write each set
Question style
- Mostly scenario-based, like the real exam: a short business or technical situation, then a question such as "Which solution meets these requirements MOST cost-effectively?" or "What should the solutions architect do?"
- Write in the style of the real exam but do NOT reproduce real exam questions, braindumps, or copyrighted practice-test material. Every question must be your own wording.
- Roughly 85–90% single-answer questions (4 options, A–D, one correct). The remaining ~10–15% are multiple-response: 5 options (A–E) with exactly two correct, and the question text ends with "(Choose two.)".
- Distractors must be plausible: real AWS services or settings that are wrong for a specific, explainable reason (wrong tier, wrong scope, higher cost, more operational overhead, does not meet a stated requirement). No joke options, no "all of the above" or "none of the above".
- Spread correct answers evenly across A, B, C and D. Do not let the longest option be correct more often than the others.
- Each question tests one idea. Do not give away the answer in the question wording.
- Cover a wide range of services and concepts within each domain, and vary difficulty (some recall, most applied, a few tricky trade-offs).

Explanations
- 1–3 sentences: why the correct answer is right, and briefly why the main distractor is wrong.

Across sets
- Sets must not repeat questions. The same service may appear again, but each set must test different scenarios and angles. Keep a running list of the topics and scenarios used so far and check against it before writing the next set.

Accuracy
- Every factual claim must be correct for the current AWS service behavior. If you cannot verify a question against AWS documentation, rewrite it or drop it. Do not guess.

## Step 3: CSV format (strict)
- Filename: {CERT_CODE}_set{NN}.csv (set01, set02, ...). UTF-8, no BOM, one header row, one question per row.
- Header, exactly:
  id,domain,question,option_a,option_b,option_c,option_d,option_e,answer,explanation
- Wrap EVERY field in double quotes. Escape a double quote inside a field by doubling it (""). Do not put line breaks inside a field.
- id: unique within the file, e.g. SAA-S01-001 (set number, then question number).
- domain: the exact domain name from the official exam guide, spelled identically on every row of that domain.
- option_e: leave empty ("") for 4-option questions.
- answer: a single letter in capitals ("B") or two letters for multiple-response ("A,C"), always referring to options that exist and are non-empty.
- Option text must not start with a letter label like "A." because the app adds the letters itself.

Example (two rows):
```csv
id,domain,question,option_a,option_b,option_c,option_d,option_e,answer,explanation
"SAA-S01-001","Design Secure Architectures","A company stores sensitive reports in Amazon S3 and must ensure objects are encrypted at rest with keys the company can rotate and audit. Which solution meets these requirements with the LEAST operational overhead?","Use SSE-S3 for all objects","Use SSE-KMS with a customer managed key","Encrypt objects on the client before upload and manage keys in a spreadsheet","Enable S3 Transfer Acceleration","","B","SSE-KMS with a customer managed key gives rotation and CloudTrail-auditable key usage without custom tooling. SSE-S3 keys are managed by AWS and cannot be audited or controlled by the company."
"SAA-S01-002","Design Resilient Architectures","Which TWO actions improve the availability of a web tier running on Amazon EC2? (Choose two.)","Place instances in an Auto Scaling group across multiple Availability Zones","Use a single large instance with more memory","Put an Application Load Balancer in front of the instances","Store session data on each instance's local disk","Disable health checks to reduce overhead","A,C","An Auto Scaling group across AZs replaces failed instances and spreads risk, and an ALB routes traffic only to healthy targets. A single instance is a single point of failure, local session state breaks failover, and disabling health checks hides failures."
```

## Step 4: Validate before delivering
Write and run a script (Python is fine) that checks every file and fails loudly on any problem:
- exactly 65 data rows and the exact header above
- ids unique within the file; no question text repeated within or across sets
- domain counts match the planned allocation, and domain names match the exam guide
- answer matches ^[A-E](,[A-E])?$ and every referenced option is non-empty
- multiple-response rows have exactly 5 non-empty options, two answers, and "(Choose two.)" in the question; single-answer rows have exactly one answer
- no option text starting with "A." / "B)" style labels, and no "all of the above" / "none of the above"
- the file parses cleanly with a standard CSV reader and round-trips (quotes and commas inside fields are preserved)
- report the answer-letter distribution per set; if any letter is outside 20–30% of single-answer questions, rebalance by reordering options (and updating the answer) and re-validate

Fix every failure and re-run until all checks pass.

## Step 5: Deliver
- Save all files in one folder (and a zip if you can), plus a short review_notes.md listing any question you are less than fully certain about, with the AWS documentation page that supports it.
- Final message: a table with one row per set (filename, number of questions, number of multiple-response questions, questions per domain) and the validation result. Do not paste the CSV contents into the chat unless I ask.
- If you cannot create files and must output text, deliver one set per message, as a single CSV code block, then wait for me to say "next".