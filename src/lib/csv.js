// CSV parsing and question-bank validation.
//
// Expected columns (header names are flexible, order does not matter):
//   question      required  the question text
//   option_a ...  required  at least two of option_a..option_j (also: a, b, c / choice_a / option1)
//   answer        required  correct letter(s): "B" or "A,C" for multiple response
//   id            optional  unique question id (defaults to Q1, Q2, ...)
//   domain        optional  exam domain, used for the per-domain score breakdown
//   explanation   optional  shown in the results review

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

// RFC 4180-style parser: quoted fields, "" escapes, newlines inside quotes, CRLF, BOM.
export function parseCsv(input) {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delim = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field === '') {
      inQuotes = true;
      i++;
    } else if (c === delim) {
      endField();
      i++;
    } else if (c === '\r') {
      if (text[i + 1] === '\n') i++;
      endRow();
      i++;
    } else if (c === '\n') {
      endRow();
      i++;
    } else {
      field += c;
      i++;
    }
  }
  if (field !== '' || row.length) endRow();
  return {
    rows: rows.filter((r) => r.some((cell) => cell.trim() !== '')),
    unterminated: inQuotes,
  };
}

const norm = (h) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

const ALIASES = {
  question: ['question', 'questiontext', 'prompt', 'stem'],
  answer: ['answer', 'answers', 'correct', 'correctanswer', 'correctanswers', 'key'],
  id: ['id', 'qid', 'questionid', 'number', 'no'],
  domain: ['domain', 'category', 'topic', 'section'],
  explanation: ['explanation', 'rationale', 'explain'],
};

function parseAnswer(raw) {
  const tokens = raw
    .toUpperCase()
    .split(/[\s,;|&/+]+/)
    .map((t) => t.replace(/[.):]+$/, ''))
    .filter(Boolean);
  if (!tokens.length) return { ok: false, error: 'the answer cell is empty' };
  const letters = [];
  for (const t of tokens) {
    if (!/^[A-J]+$/.test(t)) {
      return { ok: false, error: `could not read answer "${raw}" (use letters such as B, or A,C)` };
    }
    letters.push(...t.split(''));
  }
  return { ok: true, letters: [...new Set(letters)].sort() };
}

export function parseQuestionBank(text) {
  const errors = [];
  const warnings = [];
  const { rows, unterminated } = parseCsv(text);
  if (unterminated) {
    errors.push('The file ends inside an unclosed quote. Check for a stray " character.');
  }
  if (rows.length < 2) {
    errors.push('No question rows found. The first row must be a header.');
    return { questions: [], errors, warnings };
  }

  const col = {};
  const optCols = [];
  rows[0].map(norm).forEach((h, idx) => {
    const key = Object.keys(ALIASES).find((k) => ALIASES[k].includes(h));
    if (key) {
      if (col[key] === undefined) col[key] = idx;
      return;
    }
    const letter = h.match(/^(?:option|choice|ans|answer)?([a-j])$/);
    const digit = h.match(/^(?:option|choice|opt)(\d{1,2})$/);
    const l = letter
      ? letter[1].toUpperCase()
      : digit && Number(digit[1]) >= 1 && Number(digit[1]) <= 10
        ? String.fromCharCode(64 + Number(digit[1]))
        : null;
    if (l && !optCols.some((o) => o.letter === l)) optCols.push({ letter: l, idx });
  });
  optCols.sort((a, b) => a.letter.localeCompare(b.letter));

  if (col.question === undefined) errors.push('Missing a "question" column.');
  if (col.answer === undefined) errors.push('Missing an "answer" column.');
  if (optCols.length < 2) errors.push('Need at least two option columns, such as option_a and option_b.');
  if (errors.length) return { questions: [], errors, warnings };

  const questions = [];
  const seenIds = new Map();
  rows.slice(1).forEach((row, i) => {
    const rowNum = i + 2; // header is row 1
    const get = (idx) => (idx === undefined ? '' : (row[idx] ?? '').trim());
    const text = get(col.question);
    if (!text) {
      errors.push(`Row ${rowNum}: question text is empty.`);
      return;
    }
    const options = optCols.map((o) => ({ key: o.letter, text: get(o.idx) })).filter((o) => o.text);
    if (options.length < 2) {
      errors.push(`Row ${rowNum}: needs at least two options.`);
      return;
    }
    const parsed = parseAnswer(get(col.answer));
    if (!parsed.ok) {
      errors.push(`Row ${rowNum}: ${parsed.error}.`);
      return;
    }
    const missing = parsed.letters.filter((l) => !options.some((o) => o.key === l));
    if (missing.length) {
      errors.push(`Row ${rowNum}: answer ${missing.join(', ')} has no matching option.`);
      return;
    }
    if (parsed.letters.length >= options.length) {
      errors.push(`Row ${rowNum}: every option is marked correct.`);
      return;
    }
    let id = get(col.id) || `Q${rowNum - 1}`;
    if (seenIds.has(id)) {
      const n = seenIds.get(id) + 1;
      seenIds.set(id, n);
      warnings.push(`Row ${rowNum}: id "${id}" is already used, renamed to "${id}-${n}".`);
      id = `${id}-${n}`;
    }
    seenIds.set(id, seenIds.get(id) ?? 1);
    questions.push({
      id,
      text,
      options,
      correct: parsed.letters,
      multi: parsed.letters.length > 1,
      explanation: get(col.explanation),
      domain: get(col.domain),
    });
  });
  return { questions, errors, warnings };
}
