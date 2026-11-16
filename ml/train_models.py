from pathlib import Path
import json
import warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).parent
DATA = ROOT / "data" / "dairy_production.csv"
df = pd.read_csv(DATA, parse_dates=["timestamp"])
features = ["milk_flow","inlet_temperature","process_temperature","pressure","equipment_load","ambient_temperature","electricity_lag1","electricity_lag2","hour"]
df["electricity_lag1"] = df.electricity_kwh.shift(1)
df["electricity_lag2"] = df.electricity_kwh.shift(2)
df["hour"] = df.timestamp.dt.hour + df.timestamp.dt.minute/60
df = df.dropna().reset_index(drop=True)
X = df[features]
y = df.electricity_kwh
n = len(df); a=int(n*.70); b=int(n*.85)
X_train,X_val,X_test=X.iloc[:a],X.iloc[a:b],X.iloc[b:]
y_train,y_val,y_test=y.iloc[:a],y.iloc[a:b],y.iloc[b:]

def metrics(name, pred):
    return {"model":name,"MAE":round(float(mean_absolute_error(y_test,pred)),3),
            "RMSE":round(float(np.sqrt(mean_squared_error(y_test,pred))),3),
            "R2":round(float(r2_score(y_test,pred)),4)}

results=[]
# Persistence baseline: next interval equals latest observed consumption.
results.append(metrics("Базовый прогноз", X_test.electricity_lag1.to_numpy()))
linear=LinearRegression().fit(X_train,y_train)
results.append(metrics("Линейная регрессия",linear.predict(X_test)))
forest=RandomForestRegressor(n_estimators=180,max_depth=12,min_samples_leaf=2,random_state=42,n_jobs=-1)
forest.fit(X_train,y_train)
results.append(metrics("Случайный лес",forest.predict(X_test)))

# Optional LSTM. Chronological train/validation/test boundaries are preserved.
lstm_result = None
try:
    import torch
    from torch import nn
    torch.manual_seed(42)
    scaler=StandardScaler().fit(X_train)
    xt=scaler.transform(X_train).astype("float32")
    xv=scaler.transform(X_val).astype("float32")
    xs=scaler.transform(X_test).astype("float32")
    ys=StandardScaler().fit(y_train.to_numpy().reshape(-1,1))
    yt=ys.transform(y_train.to_numpy().reshape(-1,1)).astype("float32").ravel()
    yv=ys.transform(y_val.to_numpy().reshape(-1,1)).astype("float32").ravel()
    ytest=ys.transform(y_test.to_numpy().reshape(-1,1)).astype("float32").ravel()
    L=12
    def windows(x,y):
        xx=np.stack([x[i-L:i] for i in range(L,len(x))])
        yy=y[L:]
        return torch.tensor(xx),torch.tensor(yy).float()
    tx,ty=windows(xt,yt); vx,vy=windows(np.vstack([xt[-L:],xv]),np.r_[yt[-L:],yv])
    class Net(nn.Module):
        def __init__(self):
            super().__init__(); self.lstm=nn.LSTM(len(features),32,batch_first=True); self.fc=nn.Linear(32,1)
        def forward(self,x):
            z,_=self.lstm(x); return self.fc(z[:,-1]).squeeze(-1)
    model=Net(); opt=torch.optim.Adam(model.parameters(),lr=.002); loss_fn=nn.MSELoss()
    best=float("inf"); patience=0; best_state=None
    for epoch in range(60):
        model.train(); opt.zero_grad(); loss=loss_fn(model(tx),ty); loss.backward(); opt.step()
        model.eval()
        with torch.no_grad(): vl=loss_fn(model(vx),vy).item()
        if vl<best: best=vl; patience=0; best_state={k:v.clone() for k,v in model.state_dict().items()}
        else: patience+=1
        if patience>=8: break
    if best_state: model.load_state_dict(best_state)
    # Include preceding 12 observations as context for test windows.
    xcontext=np.vstack([np.vstack([xt,xv])[-L:],xs])
    ycontext=np.r_[np.zeros(L,dtype="float32"),ytest]
    qx,_=windows(xcontext,ycontext)
    with torch.no_grad(): pred_scaled=model(qx).numpy()
    pred=ys.inverse_transform(pred_scaled.reshape(-1,1)).ravel()
    results.append(metrics("LSTM",pred))
    lstm_result="trained"
except ImportError:
    lstm_result="PyTorch не установлен — LSTM пропущена"

ROOT.joinpath("model_metrics.json").write_text(json.dumps({
    "seed":42,"observations":len(df),"split":{"train":int(a),"validation":int(b-a),"test":int(n-b)},
    "models":results,"lstm_status":lstm_result
},ensure_ascii=False,indent=2),encoding="utf-8")

# Validation residual threshold for anomaly alerts (95th percentile).
val_pred=forest.predict(X_val)
threshold=float(np.percentile(np.abs(y_val.to_numpy()-val_pred),95))
(ROOT/"anomaly_threshold.json").write_text(json.dumps({"method":"95th percentile of validation absolute errors","threshold_kwh":round(threshold,3)},indent=2),encoding="utf-8")

pred=forest.predict(X_test)
plt.figure(figsize=(11,4))
plt.plot(df.timestamp.iloc[b:],y_test.to_numpy(),label="Факт",linewidth=1)
plt.plot(df.timestamp.iloc[b:],pred,label="Random Forest",linewidth=1)
plt.title("Фактическое и прогнозируемое потребление электроэнергии")
plt.xlabel("Время"); plt.ylabel("кВт·ч"); plt.legend(); plt.tight_layout()
plt.savefig(ROOT/"fact_vs_forecast.png",dpi=150)
print(json.dumps(results,ensure_ascii=False,indent=2))
print(f"Anomaly threshold: {threshold:.3f} kWh")
