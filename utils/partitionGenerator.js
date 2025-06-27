// backend/utils/partitionGenerator.js

const { processDataDictionary } = require('./ecpParser');

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

module.exports = async function generatePartitions(dataDictionaryPath) {
  const {
    inputsMeta,       // [ { varName, scale }, … ]
    outputMeta,       // { varName, scale }
    rangeConditions,  // [ { id, varName, min, max, mid }, … ]
    typeConditions,   // [ { id, varName, label }, … ]
    actions           // [ { id, value }, … ]
  } = await processDataDictionary(dataDictionaryPath);

  const partitions = [];

  // 1) One partition per INPUT
  for (let { varName, scale } of inputsMeta) {
    if (scale === 'Range') {
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
          items.push({
            id:     b.id,
            label:  `[${b.min}, ${b.max})`,
            sample: b.mid
          });
        });

        const lastMax = buckets[buckets.length - 1].max;
        items.push({
          id:     'overflow',
          label:  `[${lastMax}, ∞)`,
          sample: lastMax + randomBetween(1, lastMax)
        });
      }

      partitions.push({ name: varName, items });
    }
    else if (scale === 'Nominal' || scale === 'Ordinal') {
      const cats = typeConditions.filter(t => t.varName === varName);
      const items = cats.map(c => ({
        id:     c.id,
        label:  c.label,
        sample: c.label
      }));
      items.push({ id: 'none', label: 'None', sample: null });
      partitions.push({ name: varName, items });
    }
  }

  // 2) Partition for OUTPUT
  {
    const { varName, scale } = outputMeta;
    const items = actions.map(a => ({
      id:     a.id,
      label:  scale === 'Interval' ? `${a.value}%` : a.value,
      sample: a.value
    }));
    items.push({ id: 'none', label: 'None', sample: null });
    partitions.push({ name: varName, items });
  }

  // 3) FILTER OUT any partitions that only have a single bucket (the “none” placeholder)
  return partitions.filter(p => p.items.length > 1);
};
