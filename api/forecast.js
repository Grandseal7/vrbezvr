function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const body = req.method === 'POST' ? (req.body || {}) : req.query;
  const scenario = body.scenario || 'normal';
  const load = clamp(Number(body.load ?? 76), 10, 100);
  const milk = clamp(Number(body.milk ?? 2400), 300, 5000);
  const energyBase = 0.082 * milk + 18 + load * 0.42;
  const waterBase = 0.19 * milk + 45 + load * 0.22;
  const factors = {
    normal: [1, 1, 1],
    demand: [1.18, 1.12, 1.15],
    raw: [0.72, 0.78, 0.74],
    downtime: [0.86, 0.91, 0.68],
    anomaly: [1.32, 1.03, 1]
  };
  const [energyFactor, waterFactor, outputFactor] = factors[scenario] || factors.normal;
  const energy = Math.round(energyBase * energyFactor * 10) / 10;
  const water = Math.round(waterBase * waterFactor * 10) / 10;
  const output = Math.round(milk * 0.96 * outputFactor);
  const anomaly = scenario === 'anomaly' || energy > energyBase * 1.2;
  const recommendedEnergy = Math.round(energy * (scenario === 'anomaly' ? 0.91 : 0.96) * 10) / 10;
  const recommendedWater = Math.round(water * 0.97 * 10) / 10;
  return res.status(200).json({
    scenario, load, milk, energy_kwh: energy, water_l: water, output_l: output,
    recommended: { energy_kwh: recommendedEnergy, water_l: recommendedWater, output_l: output, energy_saving_pct: Math.round((1 - recommendedEnergy / energy) * 1000) / 10 },
    anomaly, warning: anomaly ? 'Обнаружено отклонение потребления энергии. Требуется проверка режима работы оборудования.' : null,
    updated_at: new Date().toISOString(),
    note: 'Расчётная симуляция, не измерения реального предприятия.'
  });
}
