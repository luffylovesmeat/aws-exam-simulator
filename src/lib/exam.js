import { makeRng, shuffle } from './rng.js';

export const EXAM_SIZE = 65; // questions presented
export const SCORED_COUNT = 50; // of which this many count toward the score

// 53-bit string hash (cyrb53). Used as a fingerprint of the uploaded question bank so a
// replayed seed can be checked against the same file.
function cyrb53(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function hashBank(questions) {
  const parts = questions.map((q) =>
    [q.id, q.text, q.options.map((o) => o.key + o.text).join('\u0002'), q.correct.join('')].join('\u0001'),
  );
  return cyrb53(parts.join('\u0003')).toString(16).padStart(14, '0');
}

// Deterministic exam from (question bank, seed):
//   1. the bank is shuffled with the seed and cut to 65 -> question order
//   2. a second, independent seeded shuffle picks which 50 positions are scored
export function buildExam(bank, seed) {
  const s = String(seed).trim();
  if (!s) throw new Error('A seed is required.');
  if (bank.length < SCORED_COUNT) {
    throw new Error(`The question set needs at least ${SCORED_COUNT} valid questions (found ${bank.length}).`);
  }
  const total = Math.min(EXAM_SIZE, bank.length);
  const ordered = shuffle(bank, makeRng(`${s}#order`)).slice(0, total);
  const scoredPositions = new Set(
    shuffle(
      ordered.map((_, i) => i),
      makeRng(`${s}#scored`),
    ).slice(0, SCORED_COUNT),
  );
  return ordered.map((q, i) => ({ ...q, position: i + 1, scored: scoredPositions.has(i) }));
}

const sameSet = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);

// Multiple-response questions are all-or-nothing, as on the real exam.
// The scaled score (100-1000) is a straight linear mapping of the scored percentage;
// AWS does not publish its real scaling, so treat this as an estimate.
export function gradeExam(questions, answers, passingScore) {
  const perQuestion = questions.map((q) => {
    const selected = [...(answers[q.id] || [])].sort();
    return { q, selected, isCorrect: selected.length > 0 && sameSet(selected, q.correct) };
  });
  const scored = perQuestion.filter((x) => x.q.scored);
  const unscored = perQuestion.filter((x) => !x.q.scored);
  const scoredCorrect = scored.filter((x) => x.isCorrect).length;
  const unscoredCorrect = unscored.filter((x) => x.isCorrect).length;
  const scaledScore = Math.round(100 + (900 * scoredCorrect) / Math.max(1, scored.length));

  const byDomain = new Map();
  for (const x of scored) {
    const name = x.q.domain || 'Unspecified';
    const d = byDomain.get(name) || { domain: name, correct: 0, total: 0 };
    d.total += 1;
    if (x.isCorrect) d.correct += 1;
    byDomain.set(name, d);
  }
  const named = [...byDomain.values()].filter((d) => d.domain !== 'Unspecified');

  return {
    perQuestion,
    scoredTotal: scored.length,
    scoredCorrect,
    unscoredTotal: unscored.length,
    unscoredCorrect,
    answeredCount: perQuestion.filter((x) => x.selected.length > 0).length,
    scaledScore,
    passed: scaledScore >= passingScore,
    domainBreakdown: named.length ? [...byDomain.values()] : [],
  };
}

// The record persisted to the JSON database.
export function buildAttempt(session, reason, cert) {
  const grade = gradeExam(session.questions, session.answers, cert.passing);
  const finishedAt = Date.now();
  const timeUsedSec = Math.min(session.durationSec, Math.round((finishedAt - session.startedAt) / 1000));
  return {
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `a-${finishedAt}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date(finishedAt).toISOString(),
    startedAt: new Date(session.startedAt).toISOString(),
    finishReason: reason, // 'submitted' | 'timeout'
    certId: cert.id,
    certCode: cert.code,
    certName: cert.name,
    csvName: session.csvName,
    csvHash: session.csvHash,
    seed: session.seed,
    totalQuestions: session.questions.length,
    scoredCount: grade.scoredTotal,
    durationSec: session.durationSec,
    timeUsedSec,
    passingScore: cert.passing,
    answeredCount: grade.answeredCount,
    scoredCorrect: grade.scoredCorrect,
    unscoredCorrect: grade.unscoredCorrect,
    scaledScore: grade.scaledScore,
    passed: grade.passed,
    domainBreakdown: grade.domainBreakdown,
    answers: grade.perQuestion.map(({ q, selected, isCorrect }) => ({
      position: q.position,
      id: q.id,
      scored: q.scored,
      domain: q.domain,
      text: q.text,
      options: q.options,
      correct: q.correct,
      selected,
      isCorrect,
      flagged: Boolean(session.flags[q.id]),
      timeSpentSec: Math.round((session.timeSpent[q.id] || 0) / 1000),
      explanation: q.explanation,
    })),
  };
}
