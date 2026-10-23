import { useRef, useState } from 'react';
import { CERTS, LEVELS, findCert } from '../lib/certs.js';
import { parseQuestionBank } from '../lib/csv.js';
import { buildExam, hashBank, EXAM_SIZE, SCORED_COUNT } from '../lib/exam.js';
import { newSeed } from '../lib/rng.js';
import { clock } from '../lib/format.js';

export default function Setup({ session, prefill, onStart, onResume, onDiscard }) {
  const [certId, setCertId] = useState(prefill?.certId || CERTS[0].id);
  const [seed, setSeed] = useState(prefill?.seed || newSeed());
  const [file, setFile] = useState(null); // { name }
  const [bank, setBank] = useState(null); // { questions, errors, warnings, hash }
  const [over, setOver] = useState(false);
  const [startError, setStartError] = useState('');
  const input = useRef(null);

  const cert = findCert(certId);
  const valid = bank?.questions.length ?? 0;
  const canStart = valid >= SCORED_COUNT && seed.trim().length > 0;
  const hashMismatch = prefill?.csvHash && bank?.hash && bank.hash !== prefill.csvHash;

  async function readFile(f) {
    if (!f) return;
    const text = await f.text();
    const parsed = parseQuestionBank(text);
    setFile({ name: f.name });
    setBank({ ...parsed, hash: parsed.questions.length ? hashBank(parsed.questions) : null });
    setStartError('');
  }

  function start() {
    try {
      const s = seed.trim();
      const questions = buildExam(bank.questions, s);
      const now = Date.now();
      onStart({
        certId,
        seed: s,
        csvName: file.name,
        csvHash: bank.hash,
        durationSec: cert.durationMin * 60,
        startedAt: now,
        endsAt: now + cert.durationMin * 60 * 1000,
        questions,
        answers: {},
        flags: {},
        current: 0,
        timeSpent: {},
      });
    } catch (e) {
      setStartError(e.message);
    }
  }

  const remaining = session ? Math.max(0, Math.round((session.endsAt - Date.now()) / 1000)) : 0;

  return (
    <main className="page page-narrow stack">
      <div>
        <h1>Set up your practice exam</h1>
        <p className="lede">
          Pick the certification, upload your question set, and the app runs it like the real sitting: a
          countdown clock, {EXAM_SIZE} questions, {SCORED_COUNT} of them scored.
        </p>
      </div>

      {session && (
        <div className="notice notice-warn">
          <b>You have an exam in progress</b> ({findCert(session.certId)?.name}, seed {session.seed}).{' '}
          {remaining > 0 ? `${clock(remaining)} left on the clock.` : 'Time has run out; resume to see your result.'}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-primary" onClick={onResume}>Resume exam</button>
            <button
              className="btn btn-danger"
              onClick={() => window.confirm('Discard the exam in progress? It will not be scored or saved.') && onDiscard()}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {prefill && (
        <div className="notice notice-info">
          Replaying seed <b className="mono">{prefill.seed}</b>. Upload the same file
          {prefill.csvName ? <> (<b>{prefill.csvName}</b>)</> : ''} to get the identical question order and scored set.
        </div>
      )}

      <section className="card">
        <label className="field" htmlFor="cert">
          Certification
          <select id="cert" value={certId} onChange={(e) => setCertId(e.target.value)}>
            {LEVELS.map((lvl) => (
              <optgroup key={lvl} label={lvl}>
                {CERTS.filter((c) => c.level === lvl).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="facts">
          <div className="fact"><b>{EXAM_SIZE}</b><span>questions</span></div>
          <div className="fact"><b>{SCORED_COUNT}</b><span>count toward score</span></div>
          <div className="fact"><b>{cert.durationMin} min</b><span>time allowed</span></div>
          <div className="fact"><b>{cert.passing}</b><span>passing score (of 1000)</span></div>
        </div>
      </section>

      <section className="card stack">
        <div>
          <h2>Question set</h2>
          <p className="muted small">A CSV with the questions, options and correct answers.</p>
        </div>
        <div
          className={`drop${over ? ' over' : ''}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); readFile(e.dataTransfer.files?.[0]); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        >
          <input ref={input} type="file" accept=".csv,text/csv,text/plain" onChange={(e) => readFile(e.target.files?.[0])} />
          <b>{file ? file.name : 'Choose a CSV file, or drop it here'}</b>
          <span className="muted small">{file ? 'Click to choose a different file' : 'One question per row'}</span>
        </div>

        {bank && (
          <div className="stack" style={{ marginTop: 0 }}>
            {valid >= SCORED_COUNT ? (
              <div className="notice notice-ok">
                <b>{valid} valid questions loaded.</b>{' '}
                {valid > EXAM_SIZE && `${EXAM_SIZE} will be drawn from them using the seed.`}
                {valid < EXAM_SIZE && `Fewer than ${EXAM_SIZE}: the exam will use all ${valid}, with ${SCORED_COUNT} scored.`}
                {valid === EXAM_SIZE && `Exactly ${EXAM_SIZE}, as on the real exam.`}
              </div>
            ) : (
              <div className="notice notice-bad">
                <b>Only {valid} valid questions found; at least {SCORED_COUNT} are needed.</b> Fix the rows below and upload again.
              </div>
            )}
            {hashMismatch && (
              <div className="notice notice-warn">
                This file differs from the one used in the original attempt, so seed <span className="mono">{prefill.seed}</span> will
                not reproduce the same exam.
              </div>
            )}
            {bank.errors.length > 0 && (
              <div className="notice notice-warn">
                <b>{bank.errors.length} row{bank.errors.length === 1 ? '' : 's'} skipped:</b>
                <ul>
                  {bank.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                  {bank.errors.length > 8 && <li>…and {bank.errors.length - 8} more.</li>}
                </ul>
              </div>
            )}
            {bank.warnings.length > 0 && (
              <div className="notice notice-info">
                <ul>{bank.warnings.slice(0, 4).map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        <details className="help">
          <summary>CSV format</summary>
          <p className="small muted" style={{ margin: '8px 0' }}>
            Column order doesn't matter. Use letters in <b>answer</b>; list several for multiple-response questions.
          </p>
          <pre>{`id,domain,question,option_a,option_b,option_c,option_d,option_e,answer,explanation
1,Security,"Which service ...?","IAM","S3","EC2","VPC",,A,"IAM controls access."
2,Storage,"Which TWO ...?","S3","EBS","Lambda","SNS","EFS","A,B","..."`}</pre>
          <ul className="small muted">
            <li>Required: question, at least two options (option_a to option_j), answer.</li>
            <li>Optional: id, domain (adds a per-domain score breakdown), explanation (shown in the review).</li>
            <li>Wrap text containing commas or line breaks in double quotes.</li>
          </ul>
          <a className="btn" href="/sample-exam.csv" download>Download a sample set</a>
        </details>
      </section>

      <section className="card stack">
        <div>
          <h2>Seed</h2>
          <p className="muted small">
            The seed fixes the question order and which {SCORED_COUNT} questions are scored. Reuse a seed with the same file to get the identical exam.
          </p>
        </div>
        <div className="seed-row">
          <label className="field" htmlFor="seed">
            Seed
            <input id="seed" type="text" className="mono" value={seed} onChange={(e) => setSeed(e.target.value)} spellCheck={false} autoComplete="off" />
          </label>
          <button className="btn" onClick={() => setSeed(newSeed())}>New random seed</button>
        </div>
      </section>

      <section className="card stack">
        <h2>Before you start</h2>
        <ul className="rules">
          <li>The clock starts when you press Start and can't be paused. When it reaches zero the exam ends and is scored.</li>
          <li>You can't tell which questions are scored. Answer every one.</li>
          <li>Flag questions to come back to them, and use Review to see what's unanswered.</li>
          <li>Multiple-response questions give credit only if every correct option is chosen.</li>
          <li>Results, seed and every answer are saved to <span className="mono">data/db.json</span> when you finish.</li>
        </ul>
        {startError && <div className="notice notice-bad">{startError}</div>}
        <div className="row">
          <button className="btn btn-primary btn-lg" disabled={!canStart} onClick={start}>
            Start exam
          </button>
          {!bank && <span className="muted small">Upload a question set to continue.</span>}
        </div>
      </section>
    </main>
  );
}
