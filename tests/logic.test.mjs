import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng, shuffle, newSeed } from '../src/lib/rng.js';
import { parseCsv, parseQuestionBank } from '../src/lib/csv.js';
import { buildExam, gradeExam, hashBank, EXAM_SIZE, SCORED_COUNT } from '../src/lib/exam.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fakeBank = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `Q${i + 1}`,
    text: `Question ${i + 1}`,
    options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }],
    correct: i % 5 === 0 ? ['A', 'C'] : ['B'],
    multi: i % 5 === 0,
    explanation: '',
    domain: i % 2 ? 'Security' : 'Compute',
  }));

test('same seed gives the same shuffle, different seed gives a different one', () => {
  const items = Array.from({ length: 30 }, (_, i) => i);
  const a = shuffle(items, makeRng('abc'));
  const b = shuffle(items, makeRng('abc'));
  const c = shuffle(items, makeRng('abd'));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.deepEqual([...a].sort((x, y) => x - y), items); // still a permutation
});

test('newSeed looks like XXXX-XXXX and varies', () => {
  const s = newSeed();
  assert.match(s, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.notEqual(s, newSeed());
});

test('buildExam: 65 questions, exactly 50 scored, reproducible by seed', () => {
  const bank = fakeBank(65);
  const e1 = buildExam(bank, 'SEED-1');
  const e2 = buildExam(bank, 'SEED-1');
  const e3 = buildExam(bank, 'SEED-2');
  assert.equal(e1.length, EXAM_SIZE);
  assert.equal(e1.filter((q) => q.scored).length, SCORED_COUNT);
  assert.equal(new Set(e1.map((q) => q.id)).size, EXAM_SIZE);
  assert.deepEqual(e1.map((q) => [q.id, q.scored]), e2.map((q) => [q.id, q.scored]));
  assert.notDeepEqual(e1.map((q) => q.id), e3.map((q) => q.id));
  assert.notDeepEqual(
    e1.filter((q) => q.scored).map((q) => q.id).sort(),
    e3.filter((q) => q.scored).map((q) => q.id).sort(),
  );
  assert.deepEqual(e1.map((q) => q.position), Array.from({ length: 65 }, (_, i) => i + 1));
});

test('buildExam: bigger bank is cut to 65, smaller than 50 is rejected, 55 gives 50 scored + 5 unscored', () => {
  assert.equal(buildExam(fakeBank(120), 'x').length, 65);
  assert.throws(() => buildExam(fakeBank(49), 'x'), /at least 50/);
  const e = buildExam(fakeBank(55), 'x');
  assert.equal(e.length, 55);
  assert.equal(e.filter((q) => q.scored).length, 50);
  assert.throws(() => buildExam(fakeBank(65), '   '), /seed/i);
});

test('each position is scored with roughly 50/65 probability across seeds', () => {
  const bank = fakeBank(65);
  let scoredFirst = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) if (buildExam(bank, `s${i}`)[0].scored) scoredFirst++;
  const p = scoredFirst / N;
  assert.ok(p > 0.72 && p < 0.82, `got ${p}, expected about 0.77`);
});

test('csv parser: quotes, commas, newlines in cells, CRLF, BOM, semicolons', () => {
  const text = '﻿a,b,c\r\n"x, y","line1\nline2","he said ""hi"""\r\n1,2,3\r\n';
  const { rows, unterminated } = parseCsv(text);
  assert.equal(unterminated, false);
  assert.deepEqual(rows, [['a', 'b', 'c'], ['x, y', 'line1\nline2', 'he said "hi"'], ['1', '2', '3']]);
  assert.deepEqual(parseCsv('a;b\n1;2').rows, [['a', 'b'], ['1', '2']]);
  assert.equal(parseCsv('a,b\n"oops,1').unterminated, true);
});

test('question bank: flexible headers, multi-answer, and row errors', () => {
  const csv = [
    'ID,Question,A,B,C,D,Correct,Rationale,Domain',
    'q1,"What, exactly?",one,two,three,four,B,because,Security',
    'q2,Pick two,one,two,three,four,"A, C",,',
    'q3,Bad answer,one,two,,,Z,,',
    'q4,,one,two,,,A,,',
    'q5,One option only,one,,,,A,,',
    'q1,Duplicate id,one,two,,,A,,',
  ].join('\n');
  const { questions, errors, warnings } = parseQuestionBank(csv);
  assert.deepEqual(questions.map((q) => q.id), ['q1', 'q2', 'q1-2']);
  assert.equal(questions[0].text, 'What, exactly?');
  assert.deepEqual(questions[0].correct, ['B']);
  assert.equal(questions[0].domain, 'Security');
  assert.equal(questions[0].explanation, 'because');
  assert.deepEqual(questions[1].correct, ['A', 'C']);
  assert.equal(questions[1].multi, true);
  assert.equal(errors.length, 3);
  assert.match(errors.join('\n'), /Row 4.*could not read answer/);
  assert.match(errors.join('\n'), /Row 5.*empty/);
  assert.match(errors.join('\n'), /Row 6.*two options/);
  assert.equal(warnings.length, 1);
});

test('question bank: missing columns are reported', () => {
  const r = parseQuestionBank('foo,bar\n1,2');
  assert.equal(r.questions.length, 0);
  assert.match(r.errors.join(' '), /question/);
  assert.match(r.errors.join(' '), /answer/);
});

test('grading: multi-response is all-or-nothing, unscored questions do not count, scale is 100-1000', () => {
  const bank = fakeBank(65);
  const exam = buildExam(bank, 'grade');

  const perfect = Object.fromEntries(exam.map((q) => [q.id, q.correct]));
  const g1 = gradeExam(exam, perfect, 720);
  assert.equal(g1.scoredCorrect, 50);
  assert.equal(g1.unscoredCorrect, 15);
  assert.equal(g1.scaledScore, 1000);
  assert.equal(g1.passed, true);

  const g0 = gradeExam(exam, {}, 720);
  assert.equal(g0.scaledScore, 100);
  assert.equal(g0.passed, false);
  assert.equal(g0.answeredCount, 0);

  // answering only the unscored questions correctly must not change the score
  const onlyUnscored = Object.fromEntries(exam.filter((q) => !q.scored).map((q) => [q.id, q.correct]));
  assert.equal(gradeExam(exam, onlyUnscored, 720).scaledScore, 100);

  // partial credit on a multi-response question is not given
  const multi = exam.find((q) => q.scored && q.multi);
  const partial = { ...perfect, [multi.id]: [multi.correct[0]] };
  assert.equal(gradeExam(exam, partial, 720).scoredCorrect, 49);
  // selection order does not matter
  const reordered = { ...perfect, [multi.id]: [...multi.correct].reverse() };
  assert.equal(gradeExam(exam, reordered, 720).scoredCorrect, 50);

  // domain breakdown covers exactly the scored questions
  assert.equal(g1.domainBreakdown.reduce((s, d) => s + d.total, 0), 50);
});

test('bank hash changes when content changes', () => {
  const a = fakeBank(10);
  const b = fakeBank(10);
  assert.equal(hashBank(a), hashBank(b));
  b[3].correct = ['C'];
  assert.notEqual(hashBank(a), hashBank(b));
});

test('sample-exam.csv: 65 valid questions, no errors, 5 multi-response', () => {
  const text = fs.readFileSync(path.join(root, 'public', 'sample-exam.csv'), 'utf8');
  const { questions, errors, warnings } = parseQuestionBank(text);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.equal(questions.length, 65);
  assert.equal(questions.filter((q) => q.multi).length, 5);
  assert.equal(new Set(questions.map((q) => q.text)).size, 65);
  assert.equal(buildExam(questions, 'demo').filter((q) => q.scored).length, 50);
});
