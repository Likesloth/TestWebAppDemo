// controllers/testRunController.js
const ExcelJS = require('exceljs');
const { stringify } = require('csv-stringify/sync');
const TestRun = require('../models/TestRun');
const { generateAll } = require('../services/testGenService');
const { buildGraphFromStateTests, buildSequenceDiagramFromSequences } = require('../services/mappers/diagramMapper');

// POST /api/runs
exports.createTestRun = async (req, res) => {
  try {
    // 1) grab buffers from multer.memoryStorage()
    // Normalize Multer files: handle .any() (array) and .fields() (object) modes
    const filesArray = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).flat();
    const findByField = (name) => {
      if (!name) return undefined;
      if (Array.isArray(req.files)) return filesArray.find(f => f.fieldname === name);
      return req.files?.[name]?.[0];
    };

    // Support current and legacy field names; if still not found, fallback to single uploaded file
    let ddFile = findByField('dataDictionary') || findByField('usecasedatadic') || findByField('useCaseDataDic');
    if (!ddFile && filesArray.length === 1) {
      ddFile = filesArray[0];
    }
    const decisionTreeFile = findByField('decisionTree');
    const stateMachineFile = findByField('stateMachine');

    const dataDictionaryBuffer = ddFile.buffer;
    const decisionTreeBuffer = decisionTreeFile?.buffer; // optional for cross-product only
    const stateMachineBuffer = stateMachineFile?.buffer; // optional

    // original filenames for metadata
    const dataDictionaryFilename = ddFile.originalname;
    const decisionTreeFilename = decisionTreeFile?.originalname || null;
    const stateMachineFilename = stateMachineFile?.originalname || null;
    const stateMachineFilenames = stateMachineFile ? [stateMachineFile.originalname] : [];

    // 2) generate everything (✅ use stateTests/stateSequences)
    const {
      partitions,
      testCases,
      crossProductCases,
      syntaxResults,
      stateTests,        // ✅ new single array of 5-col rows
      stateSequences,    // ✅ sequences
      stateTreeNodes,    // ✅ unfolded tree nodes
      stateTreeLinks,    // ✅ unfolded tree links
      ecpCsvData,
      ecpCrossCsvData,
      syntaxCsvData,
      stateCsvData,
      stateSeqCsvData,
      combinedCsvData
    } = await generateAll(dataDictionaryBuffer, decisionTreeBuffer, stateMachineBuffer);

    // 3) persist to Mongo (✅ store stateTests directly)
    const run = await TestRun.create({
      user: req.user.id,
      dataDictionaryFilename,
      decisionTreeFilename,
      stateTransitionFilename: stateMachineFilename,
      stateMachineFilename,
      stateMachineFilenames,
      partitions,
      testCases,
      syntaxResults,
      crossProductCases,
      stateTests,
      stateSequences,
      stateTreeNodes,
      stateTreeLinks,
      ecpCsvData,
      ecpCrossCsvData,
      syntaxCsvData,
      stateCsvData,
      stateSeqCsvData,
      combinedCsvData
    });

    // Build GoJS model data via mappers
    const { nodes, links } = buildGraphFromStateTests(stateTests || []);
    const { seqNodes, seqLinks } = buildSequenceDiagramFromSequences(stateSequences || []);

    // 5) return metadata + URLs + diagram data
    const base = `${req.protocol}://${req.get('host')}/api/runs/${run._id}`;
    return res.json({
      success: true,
      runId: run._id,
      partitions,
      testCases,
      syntaxResults,
      stateTests,                 // ✅ primary
      crossProductCases,
      // Deprecated compatibility fields can be derived outside if needed
      // stateValid / stateInvalid removed in favor of stateTests
      stateSequences,
      nodes,
      links,
      // Tree-friendly, sequence-expanded nodes/links (legacy)
      seqNodes,
      seqLinks,
      // New: Unfolded state tree with event labels
      stateTreeNodes,
      stateTreeLinks,
      ecpCsvUrl: `${base}/ecp-csv`,
      ecpCrossCsvUrl: `${base}/ecp-cross-csv`,
      syntaxCsvUrl: `${base}/syntax-csv`,
      stateCsvUrl: `${base}/state-csv`,
      // if you expose a separate sequences CSV endpoint, add it here:
      // stateSeqCsvUrl: `${base}/state-seq-csv`,
      combinedCsvUrl: `${base}/csv`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/runs
exports.listTestRuns = async (req, res) => {
  try {
    const runs = await TestRun.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .select('_id dataDictionaryFilename decisionTreeFilename stateTransitionFilename stateMachineFilename stateMachineFilenames createdAt');
    return res.json({ success: true, runs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/runs/:id
exports.getTestRun = async (req, res) => {
  try {
    // Fetch the run as a plain object
    const run = await TestRun.findOne({
      _id: req.params.id,
      user: req.user.id
    }).lean();

    if (!run) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    // Unified accessor (handles new rows with transitionDescription and old rows with startState/expectedState)
    const stateTests = run.stateTests || [];

    // Helper to extract from/to for any row
    const parseFromTo = (row) => {
      if (row.transitionDescription) {
        const td = String(row.transitionDescription);
        if (td.includes('→')) {
          const [from, to] = td.split('→').map(s => s.trim());
          return { from, to };
        }
        if (td.includes('-->')) {
          const [from, to] = td.split('-->').map(s => s.trim());
          return { from, to };
        }
      }
      // Fallback (older data)
      const from = (row.startState || '').trim();
      const to = (row.expectedState || '').trim();
      return { from, to };
    };

    // Build nodes & links from VALID rows only
    const stateValidArr = stateTests.filter(t => t.type === 'Valid');
    const stateInvalidArr = stateTests.filter(t => t.type === 'Invalid');

    const nodeSet = new Set();
    stateTests.forEach(t => {
      const { from, to } = parseFromTo(t);
      if (from) nodeSet.add(from);
      if (to) nodeSet.add(to);
    });
    const nodes = Array.from(nodeSet).map(key => ({ key }));

    const links = stateValidArr.map(t => {
      const { from, to } = parseFromTo(t);
      return { from, to, text: '' }; // no event in the new matrix shape
    });

    // Respond
    const base = `${req.protocol}://${req.get('host')}/api/runs/${run._id}`;
    return res.json({
      success: true,
      dataDictionaryFilename: run.dataDictionaryFilename,
      decisionTreeFilename: run.decisionTreeFilename,
      stateTransitionFilename: run.stateTransitionFilename,
      stateMachineFilename: run.stateMachineFilename,
      stateMachineFilenames: run.stateMachineFilenames,
      partitions: run.partitions,
      testCases: run.testCases,
      syntaxResults: run.syntaxResults,

      // New primary arrays
      stateTests,              // merged single-transition rows (Valid + Invalid)
      stateValid: stateValidArr,
      stateInvalid: stateInvalidArr,
      stateSequences: run.stateSequences || [],

      // Diagram data
      nodes,
      links,
      // Tree-friendly, sequence-expanded nodes/links
      seqNodes: (() => {
        const seqNodeMap = new Map();
        (run.stateSequences || []).forEach(s => {
          const path = Array.isArray(s.sequence) ? s.sequence : [];
          for (let i = 0; i < path.length; i++) {
            const state = path[i];
            const key = `${s.seqCaseID}:${String(i).padStart(2, '0')}:${state}`;
            if (!seqNodeMap.has(key)) seqNodeMap.set(key, { key, label: state });
          }
        });
        return Array.from(seqNodeMap.values());
      })(),
      seqLinks: (() => {
        const links = [];
        (run.stateSequences || []).forEach(s => {
          const path = Array.isArray(s.sequence) ? s.sequence : [];
          for (let i = 1; i < path.length; i++) {
            const prevKey = `${s.seqCaseID}:${String(i - 1).padStart(2, '0')}:${path[i - 1]}`;
            const key = `${s.seqCaseID}:${String(i).padStart(2, '0')}:${path[i]}`;
            links.push({ from: prevKey, to: key, text: '' });
          }
        });
        return links;
      })(),
      // New: persisted unfolded state tree (preferred for diagram)
      stateTreeNodes: run.stateTreeNodes || [],
      stateTreeLinks: run.stateTreeLinks || [],

      // Download URLs
      ecpCsvUrl: `${base}/ecp-csv`,
      ecpCrossCsvUrl: `${base}/ecp-cross-csv`,
      syntaxCsvUrl: `${base}/syntax-csv`,
      stateCsvUrl: `${base}/state-csv`,
      combinedCsvUrl: `${base}/csv`
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/runs/:id/ecp-csv
exports.downloadEcpCsv = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id);
    if (!run) return res.status(404).send('Not found');
    res.header('Content-Type', 'text/csv');
    res.attachment(`ecp-${run._id}.csv`);

    // If no Decision Tree was provided for this run, return cross-product CSV
    // (recompute on-demand from partitions if not embedded)
    if (!run.decisionTreeFilename) {
      if (run.ecpCrossCsvData && run.ecpCrossCsvData.length) {
        return res.send(run.ecpCrossCsvData);
      }
      const partitions = Array.isArray(run.partitions) ? run.partitions : [];
      const outVar = (() => {
        const first = (run.testCases || [])[0] || {};
        const keys = first.expected ? Object.keys(first.expected) : [];
        return keys.length ? keys[0] : null;
      })();
      const used = partitions
        .filter(p => p && Array.isArray(p.items) && p.items.length)
        .filter(p => !outVar || p.name !== outVar)
        .map(p => ({
          name: p.name,
          items: p.items.filter(it => {
            const id = String(it.id || '').toLowerCase();
            return id !== 'none' && id !== 'underflow' && id !== 'overflow';
          })
        }));
      if (!used.length) return res.send(run.ecpCsvData || '');
      const arrays = used.map(p => p.items.map(it => ({ var: p.name, sample: it.sample })));
      const combos = arrays.reduce((acc, curr) => {
        if (!acc.length) return curr.map(x => [x]);
        const next = [];
        for (const pre of acc) for (const x of curr) next.push([...pre, x]);
        return next;
      }, []);
      const names = used.map(p => p.name);
      const header = ['Test Case ID', 'Type', ...names, 'Coverage (%)'];
      const total = Math.max(combos.length, 1);
      const rows = combos.map((combo, idx) => {
        const inputs = {};
        combo.forEach(c => { inputs[c.var] = c.sample; });
        return [
          `TC${String(idx + 1).padStart(3, '0')}`,
          'Valid',
          ...names.map(n => inputs[n]),
          `${(((idx + 1) / total) * 100).toFixed(2)}%`
        ];
      });
      const csv = stringify([header, ...rows]);
      return res.send(csv);
    }

    // With Decision Tree present, return the stored rule-based ECP CSV
    res.send(run.ecpCsvData);
  } catch {
    res.status(500).send('Server error');
  }
};

// GET /api/runs/:id/ecp-cross-csv
exports.downloadEcpCrossCsv = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id);
    if (!run) return res.status(404).send('Not found');
    res.header('Content-Type', 'text/csv');
    res.attachment(`ecp-cross-${run._id}.csv`);
    if (run.ecpCrossCsvData && run.ecpCrossCsvData.length) {
      return res.send(run.ecpCrossCsvData);
    }

    // Recompute on demand from saved partitions to avoid storing huge CSVs
    const partitions = Array.isArray(run.partitions) ? run.partitions : [];
    const outVar = (() => {
      const first = (run.testCases || [])[0] || {};
      const keys = first.expected ? Object.keys(first.expected) : [];
      return keys.length ? keys[0] : null;
    })();

    const used = partitions
      .filter(p => p && Array.isArray(p.items) && p.items.length)
      .filter(p => !outVar || p.name !== outVar)
      .map(p => ({
        name: p.name,
        // Keep only VALID buckets (exclude 'none', 'underflow', 'overflow')
        items: p.items.filter(it => {
          const id = String(it.id || '').toLowerCase();
          return id !== 'none' && id !== 'underflow' && id !== 'overflow';
        })
      }));

    if (!used.length) return res.send('');

    // Cartesian product
    const arrays = used.map(p => p.items.map(it => ({ var: p.name, sample: it.sample })));
    const combos = arrays.reduce((acc, curr) => {
      if (!acc.length) return curr.map(x => [x]);
      const next = [];
      for (const pre of acc) for (const x of curr) next.push([...pre, x]);
      return next;
    }, []);

    const names = used.map(p => p.name);
    const header = ['Test Case ID', 'Type', ...names, 'Coverage (%)'];

    // Build baseline from first valid item per variable
    const baseline = {};
    used.forEach(p => { const it = (p.items[0] || {}); baseline[p.name] = it.sample; });

    // Build invalid entries from original partitions (underflow/overflow/none)
    const invalidEntries = [];
    for (const p of partitions) {
      if (!names.includes(p.name)) continue;
      const uf = p.items.find(it => String(it.id || '').toLowerCase() === 'underflow');
      const of = p.items.find(it => String(it.id || '').toLowerCase() === 'overflow');
      const nn = p.items.find(it => String(it.id || '').toLowerCase() === 'none');
      if (uf) invalidEntries.push({ var: p.name, value: uf.sample });
      if (of) invalidEntries.push({ var: p.name, value: of.sample });
      if (nn) invalidEntries.push({ var: p.name, value: nn.sample });
    }

    const total = Math.max(combos.length + invalidEntries.length, 1);
    const validRows = combos.map((combo, idx) => {
      const inputs = { ...baseline };
      combo.forEach(c => { inputs[c.var] = c.sample; });
      return [
        `TC${String(idx + 1).padStart(3, '0')}`,
        'Valid',
        ...names.map(n => inputs[n]),
        `${(((idx + 1) / total) * 100).toFixed(2)}%`
      ];
    });

    const startInvalid = combos.length + 1;
    const invalidRows = invalidEntries.map((ent, i) => {
      const inputs = { ...baseline };
      inputs[ent.var] = ent.value;
      const idx = startInvalid + i;
      return [
        `TC${String(idx).padStart(3, '0')}`,
        'Invalid',
        ...names.map(n => inputs[n]),
        `${((idx / total) * 100).toFixed(2)}%`
      ];
    });

    const csv = stringify([header, ...validRows, ...invalidRows]);
    return res.send(csv);
  } catch {
    res.status(500).send('Server error');
  }
};

// GET /api/runs/:id/syntax-csv
exports.downloadSyntaxCsv = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id);
    if (!run) return res.status(404).send('Not found');
    res.header('Content-Type', 'text/csv');
    res.attachment(`syntax-${run._id}.csv`);
    res.send(run.syntaxCsvData);
  } catch {
    res.status(500).send('Server error');
  }
};

// GET /api/runs/:id/state-csv  → Excel workbook with two sheets
exports.downloadStateCsv = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id).lean();
    if (!run) return res.status(404).send('Not found');

    const wb = new ExcelJS.Workbook();

    // ---- Sheet 1: Single-Step State Tests ----
    const stateSingleSheet = wb.addWorksheet('State Single-Step');
    stateSingleSheet.columns = [
      { header: 'Test Case ID', key: 'testCaseID' },
      { header: 'Type', key: 'type' },
      { header: 'Start State', key: 'startState' },
      { header: 'Transition Description', key: 'transitionDescription' },
      { header: 'Expected State', key: 'expectedState' },
      { header: 'Coverage (%)', key: 'coverage', style: { numFmt: '0.00%' } }
    ];

    const stateTests = (run.stateTests || []);
    const stateValid = stateTests.filter(tc => tc.type === 'Valid');
    const stateInvalid = stateTests.filter(tc => tc.type === 'Invalid');

    const attemptDest = (tc) => tc.attemptedState || tc.expectedState || '';

    let counter = 1;
    const totalSingles = Math.max(stateTests.length, 1);

    // Valid rows
    stateValid.forEach(tc => {
      const id = `TC${String(counter).padStart(3, '0')}`;
      stateSingleSheet.addRow({
        type: 'Valid',
        testCaseID: id,
        startState: tc.startState,
        transitionDescription: tc.transitionDescription || `${tc.startState} → ${tc.expectedState}`,
        expectedState: tc.expectedState,
        coverage: counter / totalSingles
      });
      counter++;
    });

    // Invalid rows (expected = attempted destination)
    stateInvalid.forEach(tc => {
      const id = `TC${String(counter).padStart(3, '0')}`;
      const to = attemptDest(tc);
      stateSingleSheet.addRow({
        type: 'Invalid',
        testCaseID: id,
        startState: tc.startState,
        transitionDescription: tc.transitionDescription || `${tc.startState} → ${to}`,
        expectedState: to,
        coverage: counter / totalSingles
      });
      counter++;
    });


    // ---- Sheet 2: Sequence State Tests ----
    const stateSeqSheet = wb.addWorksheet('State Sequences');
    stateSeqSheet.columns = [
      { header: 'Test Case ID', key: 'testCaseID' },
      { header: 'Sequence of Transitions', key: 'sequence' },
      { header: 'Coverage (%)', key: 'coverage', style: { numFmt: '0.00%' } }
    ];

    let seqCounter = 1;
    const totalSeq = Math.max((run.stateSequences || []).length, 1);
    (run.stateSequences || []).forEach(s => {
      const id = `TC${String(seqCounter).padStart(3, '0')}`;
      stateSeqSheet.addRow({
        testCaseID: id,
        sequence: Array.isArray(s.sequence) ? s.sequence.join(' → ') : '',
        coverage: seqCounter / totalSeq
      });
      seqCounter++;
    });

    // stream workbook
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="state-${run._id}.xlsx"`
    );
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

// GET /api/runs/:id/csv  → combined Excel workbook with ECP, Syntax, State Single-Step, State Sequences
exports.downloadCombined = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id).lean();
    if (!run) return res.status(404).send('Not found');

    const wb = new ExcelJS.Workbook();

    // ECP sheet
    const ecpSheet = wb.addWorksheet('ECP Test Cases');
    const ecpInputKeys = run.testCases.length ? Object.keys(run.testCases[0].inputs) : [];
    const ecpExpectedKeys = run.testCases.length ? Object.keys(run.testCases[0].expected) : [];
    ecpSheet.columns = [
      { header: 'Test Case ID', key: 'testCaseID' },
      { header: 'Type', key: 'type' },
      ...ecpInputKeys.map(k => ({ header: k, key: k })),
      ...ecpExpectedKeys.map(k => ({ header: k, key: `exp_${k}` })),
      { header: 'Coverage (%)', key: 'coverage', style: { numFmt: '0.00%' } }
    ];
    const totalEcp = Math.max(run.testCases.length, 1);
    run.testCases.forEach((tc, idx) => {
      const row = { testCaseID: tc.testCaseID, type: tc.type || 'Valid', coverage: (idx + 1) / totalEcp };
      ecpInputKeys.forEach(k => row[k] = tc.inputs[k]);
      ecpExpectedKeys.forEach(k => row[`exp_${k}`] = tc.expected[k]);
      ecpSheet.addRow(row);
    });

    // ECP Cross-Product (comparison) sheet
    const crossSheet = wb.addWorksheet('ECP Cross Product');
    let crossCases = Array.isArray(run.crossProductCases) ? run.crossProductCases : [];
    let crossInputKeys = crossCases.length ? Object.keys(crossCases[0].inputs) : [];
    // If not embedded, recompute from partitions for the Excel sheet
    if (!crossCases.length) {
      const partitions = Array.isArray(run.partitions) ? run.partitions : [];
      const outVar = (() => {
        const first = (run.testCases || [])[0] || {};
        const keys = first.expected ? Object.keys(first.expected) : [];
        return keys.length ? keys[0] : null;
      })();
      const used = partitions
        .filter(p => p && Array.isArray(p.items) && p.items.length)
        .filter(p => !outVar || p.name !== outVar)
        .map(p => ({
          name: p.name,
          items: p.items.filter(it => {
            const id = String(it.id || '').toLowerCase();
            return id !== 'none' && id !== 'underflow' && id !== 'overflow';
          })
        }));
      const arrays = used.map(p => p.items.map(it => ({ var: p.name, sample: it.sample })));
      const combos = arrays.reduce((acc, curr) => {
        if (!acc.length) return curr.map(x => [x]);
        const next = [];
        for (const pre of acc) for (const x of curr) next.push([...pre, x]);
        return next;
      }, []);
      crossInputKeys = used.map(p => p.name);
      crossCases = combos.map((combo, idx) => {
        const inputs = {};
        combo.forEach(c => { inputs[c.var] = c.sample; });
        return { testCaseID: `TC${String(idx + 1).padStart(3, '0')}`, type: 'Valid', inputs };
      });
    }
    crossSheet.columns = [
      { header: 'Test Case ID', key: 'testCaseID' },
      { header: 'Type', key: 'type' },
      ...crossInputKeys.map(k => ({ header: k, key: k })),
      { header: 'Coverage (%)', key: 'coverage', style: { numFmt: '0.00%' } }
    ];
    // If we recomputed crossCases above, they currently contain only valids.
    // Append DD-based invalids derived from partitions for completeness.
    let invalidEntries = [];
    if (!Array.isArray(run.crossProductCases) || run.crossProductCases.length === 0) {
      const partitions = Array.isArray(run.partitions) ? run.partitions : [];
      for (const p of partitions) {
        if (!crossInputKeys.includes(p.name)) continue;
        const uf = p.items.find(it => String(it.id || '').toLowerCase() === 'underflow');
        const of = p.items.find(it => String(it.id || '').toLowerCase() === 'overflow');
        const nn = p.items.find(it => String(it.id || '').toLowerCase() === 'none');
        if (uf) invalidEntries.push({ var: p.name, value: uf.sample });
        if (of) invalidEntries.push({ var: p.name, value: of.sample });
        if (nn) invalidEntries.push({ var: p.name, value: nn.sample });
      }
    }

    const totalCross = Math.max(crossCases.length + invalidEntries.length, 1);
    crossCases.forEach((tc, idx) => {
      const row = { testCaseID: tc.testCaseID, type: tc.type || 'Valid', coverage: (idx + 1) / totalCross };
      crossInputKeys.forEach(k => row[k] = tc.inputs[k]);
      crossSheet.addRow(row);
    });

    for (let i = 0; i < invalidEntries.length; i++) {
      const idx = crossCases.length + 1 + i;
      const ent = invalidEntries[i];
      // baseline: first valid per column from existing first case if present
      const base = {};
      if (crossCases[0]) crossInputKeys.forEach(k => base[k] = crossCases[0].inputs[k]);
      base[ent.var] = ent.value;
      const row = { testCaseID: `TC${String(idx).padStart(3, '0')}`, type: 'Invalid', coverage: idx / totalCross };
      crossInputKeys.forEach(k => row[k] = base[k]);
      crossSheet.addRow(row);
    }

    // Syntax sheet
    const syntaxSheet = wb.addWorksheet('Syntax Test Cases');
    syntaxSheet.columns = [
      { header: 'Name', key: 'name' },
      { header: 'Valid', key: 'valid' },
      { header: 'Invalid Value', key: 'invalidValue' },
      { header: 'Invalid Omission', key: 'invalidOmission' },
      { header: 'Invalid Addition', key: 'invalidAddition' },
      { header: 'Invalid Substitution', key: 'invalidSubstitution' }
    ];
    run.syntaxResults.forEach(sr => {
      syntaxSheet.addRow({
        name: sr.name,
        valid: sr.testCases.valid,
        invalidValue: sr.testCases.invalidValue,
        invalidOmission: sr.testCases.invalidOmission,
        invalidAddition: sr.testCases.invalidAddition,
        invalidSubstitution: sr.testCases.invalidSubstitution
      });
    });

    // ---- State Single-Step sheet ----
    const stateSingleSheet = wb.addWorksheet('State Test Cases');
    stateSingleSheet.columns = [
      { header: 'Test Case ID', key: 'testCaseID' },
      { header: 'Type', key: 'type' },
      { header: 'Start State', key: 'startState' },
      { header: 'Transition Description', key: 'transitionDescription' },
      { header: 'Expected State', key: 'expectedState' },
      { header: 'Coverage (%)', key: 'coverage', style: { numFmt: '0.00%' } }
    ];

    const stateTests = (run.stateTests || []);
    const stateValid = stateTests.filter(tc => tc.type === 'Valid');
    const stateInvalid = stateTests.filter(tc => tc.type === 'Invalid');
    const attemptDest = (tc) => tc.attemptedState || tc.expectedState || '';

    let counter = 1;
    const totalSingles = Math.max(stateTests.length, 1);

    // Valid rows
    stateValid.forEach(tc => {
      const id = `TC${String(counter).padStart(3, '0')}`;
      stateSingleSheet.addRow({
        type: 'Valid',
        testCaseID: id,
        startState: tc.startState,
        transitionDescription: tc.transitionDescription || `${tc.startState} → ${tc.expectedState}`,
        expectedState: tc.expectedState,
        coverage: counter / totalSingles
      });
      counter++;
    });

    // Invalid rows
    stateInvalid.forEach(tc => {
      const id = `TC${String(counter).padStart(3, '0')}`;
      const to = attemptDest(tc);
      stateSingleSheet.addRow({
        type: 'Invalid',
        testCaseID: id,
        startState: tc.startState,
        transitionDescription: tc.transitionDescription || `${tc.startState} → ${to}`,
        expectedState: to,
        coverage: counter / totalSingles
      });
      counter++;
    });


    // ---- State Sequences sheet ----
    const stateSeqSheet = wb.addWorksheet('State Sequences');
    stateSeqSheet.columns = [
      { header: 'Test Case ID', key: 'testCaseID' },
      { header: 'Sequence of Transitions', key: 'sequence' },
      { header: 'Coverage (%)', key: 'coverage', style: { numFmt: '0.00%' } }
    ];

    let seqCounter = 1;
    const totalSeq = Math.max((run.stateSequences || []).length, 1);
    (run.stateSequences || []).forEach(s => {
      const id = `TC${String(seqCounter).padStart(3, '0')}`;
      stateSeqSheet.addRow({
        testCaseID: id,
        sequence: Array.isArray(s.sequence) ? s.sequence.join(' → ') : '',
        coverage: seqCounter / totalSeq
      });
      seqCounter++;
    });

    // stream workbook
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="testRun-${run._id}.xlsx"`
    );
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

// GET /api/runs/:id/combined-csv → legacy single CSV (already computed in service)
exports.downloadCombinedCsvLegacy = async (req, res) => {
  try {
    const run = await TestRun.findById(req.params.id).lean();
    if (!run) return res.status(404).send('Not found');
    res.header('Content-Type', 'text/csv');
    res.attachment(`combined-${run._id}.csv`);
    res.send(run.combinedCsvData || '');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};



