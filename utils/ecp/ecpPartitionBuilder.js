// backend/utils/ecp/ecpPartitionBuilder.js
// Purpose: Build user-friendly ECP partitions for inputs/outputs from a
// Data Dictionary, for display and sampling in the UI.
// Exports: async function (dataDictionaryPath|Buffer) -> Array<Partition>
// Partition shape: { name, items: [{ id, label, sample }] }
// Notes: Adds underflow/overflow buckets for Range and a None bucket for Nominal.
const { processDataDictionary } = require('./ecpXmlParsers');

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

module.exports = async function generatePartitions(dataDictionaryPath) {
  const {
    inputsMeta,       // [ { varName, type }, … ]
    outputMeta,       // { varName, type }
    rangeConditions,  // [ { id, varName, min, max, mid }, … ]
    typeConditions,   // [ { id, varName, label }, … ]
    actions           // [ { id, value }, … ]
  } = await processDataDictionary(dataDictionaryPath);

  const partitions = [];

  // 1) One partition per INPUT
  for (let { varName, type } of inputsMeta) {
    if (type === 'Range') {
      const buckets = rangeConditions
        .filter(r => r.varName === varName)
        .sort((a, b) => a.min - b.min);

      const items = [];
      if (buckets.length > 0) {
        const firstMin = buckets[0].min;
        items.push({
          id:     'underflow',
          label:  `(-∞, ${firstMin})`,
          sample: randomBetween(0, firstMin)
        });

        buckets.forEach(b => {
          const label = (b.min === b.max)
            ? String(b.min)
            : `(${b.min}, ${b.max})`; // display with parentheses consistently
          items.push({ id: b.id, label, sample: b.mid });
        });

        const lastMax = buckets[buckets.length - 1].max;
        items.push({
          id:     'overflow',
          label:  `(${lastMax}, ∞)`,
          sample: lastMax + randomBetween(1, lastMax)
        });
      }

      partitions.push({ name: varName, items });
    }
    else if (type === 'Nominal') {
      const cats = typeConditions.filter(t => t.varName === varName);
      const items = cats.map(c => ({
        id:     c.id,
        label:  c.label,
        sample: c.label
      }));
      // Use visible placeholder for invalid/none bucket
      items.push({ id: 'none', label: 'None', sample: 'N/A' });
      partitions.push({ name: varName, items });
    }
  }

  // 2) Partition for OUTPUT (optional)
  if (outputMeta && Array.isArray(actions)) {
    const { varName } = outputMeta;
    const numericActs = actions
      .map(a => ({ id: a.id, valueStr: a.value, valueNum: Number(a.value) }))
      .filter(a => Number.isFinite(a.valueNum));

    let items = [];
    if (numericActs.length === actions.length && numericActs.length > 0) {
      const sorted = [...numericActs].sort((a, b) => a.valueNum - b.valueNum);
      const unique = [];
      const seen = new Set();
      for (const a of sorted) {
        if (!seen.has(a.valueNum)) {
          unique.push(a);
          seen.add(a.valueNum);
        }
      }
      const min = unique[0];
      const max = unique[unique.length - 1];
      const rangeId = `${min.id}-${max.id}`;
      const rangeLabel = (min.valueNum === max.valueNum)
        ? String(min.valueNum)
        : `(${min.valueNum}, ${max.valueNum})`;
      items.push({ id: rangeId, label: rangeLabel, sample: min.valueNum });
    } else if (actions.length > 0) {
      items = actions.map(a => ({ id: a.id, label: a.value, sample: a.value }));
    }

    if (items.length > 0) {
      // Use visible placeholder for invalid/none bucket
      items.push({ id: 'none', label: 'None', sample: 'N/A' });
      partitions.push({ name: varName, items });
    }
  }

  // 3) FILTER OUT any partitions that only have a single bucket
  return partitions.filter(p => p.items.length > 1);
};
