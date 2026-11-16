from pathlib import Path
import numpy as np
import pandas as pd

SEED = 42
N = 5000
rng = np.random.default_rng(SEED)
out = Path(__file__).parent / "data"
out.mkdir(exist_ok=True)

t = pd.date_range("2026-01-01", periods=N, freq="5min")
hour = t.hour.to_numpy() + t.minute.to_numpy()/60
batch = np.arange(N)//36 + 1
mode = np.where((np.arange(N)%288)<250, "production", "cleaning")
mode = np.where((np.arange(N)%288)<265, mode, "idle")
ambient = 18 + 7*np.sin(2*np.pi*np.arange(N)/(288*30)) + rng.normal(0, 1.2, N)
flow = np.where(mode=="production", 2200 + 230*np.sin(2*np.pi*hour/24) + rng.normal(0,90,N), 0)
inlet = 8 + rng.normal(0, .7, N)
process_temp = np.where(mode=="production", 76 + rng.normal(0, .8, N), 24 + rng.normal(0,2,N))
pressure = np.where(mode=="production", 2.1 + rng.normal(0,.12,N), .4 + rng.normal(0,.08,N))
load = np.where(mode=="production", np.clip(65 + flow/100 + rng.normal(0,5,N), 30, 100), np.where(mode=="cleaning", 28, 8))
energy = np.where(mode=="production", 42 + .055*flow + .28*load + .35*(ambient-18) + rng.normal(0,4,N), np.where(mode=="cleaning", 58+rng.normal(0,4,N), 9+rng.normal(0,1,N)))
water = np.where(mode=="production", 35 + .10*flow + rng.normal(0,12,N), np.where(mode=="cleaning", 520+rng.normal(0,25,N), 12+rng.normal(0,3,N)))
output = np.where(mode=="production", flow*.94 + rng.normal(0,35,N), 0)
downtime = np.where(mode=="production", np.maximum(0,rng.normal(1.2,1.5,N)), np.where(mode=="idle", 5, 0))
# Known synthetic anomalies: abnormal energy increase over several intervals.
anomaly_idx = np.arange(3100, 3112)
energy[anomaly_idx] *= 1.55

df = pd.DataFrame({
    "timestamp": t, "batch_id": batch, "product_type": "pasteurized_milk",
    "milk_flow": np.round(flow,2), "inlet_temperature": np.round(inlet,2),
    "process_temperature": np.round(process_temp,2), "pressure": np.round(pressure,3),
    "equipment_load": np.round(load,2), "ambient_temperature": np.round(ambient,2),
    "operating_mode": mode, "electricity_kwh": np.round(energy,3),
    "water_l": np.round(water,2), "output_l": np.round(output,2),
    "downtime_min": np.round(downtime,2), "known_anomaly": 0
})
df.loc[anomaly_idx, "known_anomaly"] = 1
df.to_csv(out/"dairy_production.csv", index=False)
print(f"Saved {len(df)} observations to {out/'dairy_production.csv'} (seed={SEED})")
