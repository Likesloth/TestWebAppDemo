const { processDataDictionary } = require('./ecpParser');

module.exports = async function generatePartitions(dataDictionaryPath) {
  const {
    inputsMeta,
    outputMeta,
    rangeConditions,
    typeConditions,
    actions
  } = await processDataDictionary(dataDictionaryPath);

  // Numeric partitions
  const mins     = rangeConditions.map(r => r.min);
  const maxs     = rangeConditions.map(r => r.max);
  const firstMin = mins[0], lastMax = maxs[maxs.length - 1];

  const rangeItems = [
    { id:'underflow', label:`(-∞, ${firstMin})`, sample: Math.floor(Math.random()*firstMin) },
    ...rangeConditions.map(r => ({
      id:    r.id,
      label: `[${r.min}, ${r.max})`,
      sample:r.mid
    })),
    { id:'overflow', label:`[${lastMax}, ∞)`, sample: lastMax + Math.floor(Math.random()*lastMax) || lastMax + 1 }
  ];

  // Ordinal partitions
  const typeItems = [
    ...typeConditions.map(tc => ({
      id:    tc.id,
      label: tc.label,
      sample: tc.label
    })),
    { id:'none', label:'None', sample:null }
  ];

  // Discount partitions
  const actionItems = [
    ...actions.map(a => ({
      id:    a.id,
      label: `${a.value}%`,
      sample: a.value
    })),
    { id:'none', label:'None', sample:null }
  ];

  // Assemble partition sets in order
  const partitionSets = [];
  inputsMeta.forEach(meta => {
    if (meta.type === 'Range') {
      partitionSets.push({ name: meta.varName, items: rangeItems });
    } else if (meta.type === 'Ordinal') {
      partitionSets.push({ name: meta.varName, items: typeItems });
    }
  });
  // Finally the output
  partitionSets.push({ name: outputMeta.varName, items: actionItems });

  return partitionSets;
};
