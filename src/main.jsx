import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronDown,
  Clock3, Droplets, Factory, Gauge, Leaf, Lightbulb, Menu, Package, Play, RefreshCw,
  Settings2, ShieldCheck, Thermometer, Zap
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip,
  XAxis, YAxis, BarChart, Bar, Legend
} from 'recharts';
import './style.css';

const scenarios = [
  { id: 'normal', label: 'Базовый режим', desc: 'Штатное выполнение плана' },
  { id: 'demand', label: 'Повышенный спрос', desc: 'Увеличение планового выпуска' },
  { id: 'raw', label: 'Ограничение сырья', desc: 'Снижение доступного молока' },
  { id: 'downtime', label: 'Простой линии', desc: 'Недоступность участка' },
  { id: 'anomaly', label: 'Избыточное потребление', desc: 'Искусственный рост расхода энергии' }
];

const seed = Array.from({ length: 24 }, (_, i) => {
  const wave = Math.sin(i / 3.1);
  return {
    time: `${String(i).padStart(2, '0')}:00`,
    energy: Math.round(206 + wave * 17 + (i > 18 ? 8 : 0) + (i === 14 ? 38 : 0)),
    water: Math.round(492 + wave * 31 + (i === 14 ? 22 : 0)),
    output: Math.round(2380 + wave * 130 - (i > 20 ? 90 : 0))
  };
});

function App() {
  const [scenario, setScenario] = useState('normal');
  const [load, setLoad] = useState(76);
  const [milk, setMilk] = useState(2400);
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('recommended');
  const [selected, setSelected] = useState('pasteurizer');
  const [busy, setBusy] = useState(false);
  const [apiState, setApiState] = useState('demo');

  const calculate = async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/forecast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, load, milk })
      });
      if (!response.ok) throw new Error('API unavailable');
      const result = await response.json();
      setData(result); setApiState('api');
    } catch {
      const factors = { normal:[1,1,1], demand:[1.18,1.12,1.15], raw:[.72,.78,.74], downtime:[.86,.91,.68], anomaly:[1.32,1.03,1] };
      const [ef,wf,of] = factors[scenario];
      const energy = Math.round((.082*milk+18+load*.42)*ef*10)/10;
      const water = Math.round((.19*milk+45+load*.22)*wf*10)/10;
      const output = Math.round(milk*.96*of);
      setData({
        scenario, energy_kwh: energy, water_l: water, output_l: output, load,
        recommended: { energy_kwh: Math.round(energy*(scenario==='anomaly'?.91:.96)*10)/10, water_l: Math.round(water*.97*10)/10, output_l: output, energy_saving_pct: scenario==='anomaly'?9:4 },
        anomaly: scenario==='anomaly', warning: scenario==='anomaly'?'Обнаружено отклонение потребления энергии. Требуется проверка режима работы оборудования.':null,
        updated_at: new Date().toISOString(), note: 'Демонстрационный локальный расчёт.'
      });
      setApiState('demo');
    }
    setBusy(false);
  };

  useEffect(() => { calculate(); }, [scenario, load, milk]);

  const currentEnergy = data ? (mode === 'recommended' ? data.recommended.energy_kwh : data.energy_kwh) : 215;
  const currentWater = data ? (mode === 'recommended' ? data.recommended.water_l : data.water_l) : 510;
  const currentOutput = data ? data.output_l : 2304;
  const chartData = useMemo(() => seed.map((d, i) => ({
    ...d,
    forecast: i > 19 ? Math.round(d.energy * (mode === 'recommended' ? .96 : 1)) : undefined
  })), [mode]);

  const equipment = [
    { id:'tank', name:'Резервуар сырья', sub:'Приёмка молока', state:'Работает', temp:'4.2 °C', load:68, icon:'tank' },
    { id:'pasteurizer', name:'Пастеризатор', sub:'Тепловая обработка', state:scenario==='downtime'?'Ожидание':'Работает', temp:'76.0 °C', load:load, icon:'heat' },
    { id:'cooler', name:'Охладитель', sub:'Охлаждение продукта', state:'Работает', temp:'4.0 °C', load:72, icon:'cool' },
    { id:'filler', name:'Фасовочная линия', sub:'Розлив и упаковка', state:scenario==='downtime'?'Предупреждение':'Работает', temp:'—', load:scenario==='downtime'?0:81, icon:'pack' }
  ];
  const activeEquipment = equipment.find(x => x.id === selected) || equipment[1];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Factory size={21}/></div><div><b>DairyMind</b><span>RESOURCE INTELLIGENCE</span></div></div>
      <div className="side-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <a className="nav active"><Activity size={17}/> Обзор производства</a>
      <a className="nav" href="#virtual"><Factory size={17}/> Виртуальный цех</a>
      <a className="nav" href="#analytics"><Gauge size={17}/> Аналитика моделей</a>
      <a className="nav" href="#recommendations"><Lightbulb size={17}/> Рекомендации</a>
      <div className="side-bottom">
        <div className="system-card"><span className="live-dot"></span><b>Система активна</b><small>Учебная симуляция</small></div>
        <div className="profile"><div className="avatar">ОП</div><div><b>Оператор</b><small>Молочный цех · №01</small></div><ChevronDown size={15}/></div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><div className="eyebrow">ПРОИЗВОДСТВО / МОНИТОРИНГ</div><h1>Панель управления</h1></div>
        <div className="top-actions"><span className="date-chip"><Clock3 size={14}/> {new Date().toLocaleDateString('ru-RU', {day:'numeric',month:'long',year:'numeric'})}</span><button className="icon-btn" onClick={calculate} title="Обновить"><RefreshCw size={17}/></button><div className="operator-chip"><div className="avatar">ОП</div><span>Оператор</span></div></div>
      </header>

      <section className="welcome-row">
        <div><h2>Добро пожаловать в цех</h2><p>Пастеризованное молоко · Линия производства №01</p></div>
        <div className="status-pill"><span className="live-dot"></span> Все системы в норме</div>
      </section>

      <section className="scenario-panel">
        <div className="scenario-title"><div><b>Экспериментальный сценарий</b><small>Выберите условия для симуляции производственного процесса</small></div><span className="sim-tag">SIMULATION</span></div>
        <div className="scenario-options">{scenarios.map(s=><button key={s.id} onClick={()=>setScenario(s.id)} className={`scenario-option ${scenario===s.id?'selected':''}`}><span className="scenario-radio"></span><span><b>{s.label}</b><small>{s.desc}</small></span></button>)}</div>
      </section>

      <section className="metric-grid">
        <Metric icon={<Zap/>} label="Электроэнергия" value={currentEnergy.toLocaleString('ru-RU')} unit="кВт·ч" trend="−4.0%" good/>
        <Metric icon={<Droplets/>} label="Расход воды" value={currentWater.toLocaleString('ru-RU')} unit="л" trend="−3.0%" good/>
        <Metric icon={<Package/>} label="Выпуск продукции" value={currentOutput.toLocaleString('ru-RU')} unit="л" trend="план" />
        <Metric icon={<Gauge/>} label="Загрузка оборудования" value={load} unit="%" trend={load>90?'Высокая':'Норма'} warning={load>90}/>
      </section>

      {data?.anomaly && <div className="alert"><AlertTriangle size={19}/><div><b>Обнаружено отклонение</b><span>{data.warning}</span></div><button onClick={()=>setScenario('normal')}>Сбросить сценарий</button></div>}

      <div className="content-grid">
        <section className="panel chart-panel" id="analytics">
          <div className="panel-head"><div><h3>Потребление электроэнергии</h3><p>Фактические значения и расчётный прогноз · последние 24 часа</p></div><span className="unit-label">кВт·ч</span></div>
          <div className="chart-legend"><span><i className="legend-dot actual"></i> Фактическое</span><span><i className="legend-dot forecast"></i> Прогноз</span></div>
          <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:8,left:-18,bottom:0}}><defs><linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#55c7a2" stopOpacity={.22}/><stop offset="95%" stopColor="#55c7a2" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e9efec"/><XAxis dataKey="time" tick={{fontSize:11,fill:'#8a9893'}} axisLine={false} tickLine={false} interval={3}/><YAxis tick={{fontSize:11,fill:'#8a9893'}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{border:'1px solid #e5ece8',borderRadius:12,fontSize:12}}/><Area type="monotone" dataKey="energy" stroke="#35ad89" strokeWidth={2.5} fill="url(#energyFill)" name="Факт"/><Line type="monotone" dataKey="forecast" stroke="#e5a64a" strokeWidth={2.5} strokeDasharray="5 4" dot={false} name="Прогноз"/></AreaChart></ResponsiveContainer></div>
          <div className="chart-foot"><span><i className="legend-dot actual"></i> Данные симуляции</span><span>Обновлено: {data ? new Date(data.updated_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) : '—'}</span></div>
        </section>

        <section className="panel control-panel">
          <div className="panel-head"><div><h3>Параметры симуляции</h3><p>Настройте условия производства</p></div><Settings2 size={18} color="#87958f"/></div>
          <div className="range-control"><div className="range-label"><span>Загрузка оборудования</span><b>{load}%</b></div><input type="range" min="20" max="100" value={load} onChange={e=>setLoad(+e.target.value)}/><div className="range-minmax"><span>20%</span><span>100%</span></div></div>
          <div className="range-control"><div className="range-label"><span>Объём сырого молока</span><b>{milk.toLocaleString('ru-RU')} л</b></div><input type="range" min="800" max="4000" step="100" value={milk} onChange={e=>setMilk(+e.target.value)}/><div className="range-minmax"><span>800 л</span><span>4 000 л</span></div></div>
          <div className="mode-switch"><span>Режим отображения</span><div><button className={mode==='current'?'on':''} onClick={()=>setMode('current')}>Исходный</button><button className={mode==='recommended'?'on':''} onClick={()=>setMode('recommended')}>Рекомендуемый</button></div></div>
          <div className="prediction-box"><div><span>Прогноз расхода энергии</span><b>{currentEnergy} <small>кВт·ч</small></b></div><div className="saving"><ArrowDownRight size={16}/> {data?.recommended?.energy_saving_pct ?? 4}% потенциального снижения</div></div>
          <button className="primary-btn" onClick={calculate} disabled={busy}>{busy?<RefreshCw className="spin" size={16}/>:<Play size={16} fill="currentColor"/>} Пересчитать прогноз</button>
        </section>
      </div>

      <section className="panel virtual-panel" id="virtual">
        <div className="panel-head"><div><h3>Виртуальный производственный цех</h3><p>Интерактивная схема оборудования · настольный прототип виртуальной среды</p></div><span className="desktop-tag">3D / DESKTOP VIEW</span></div>
        <div className="factory-layout">
          <div className="factory-map">
            <div className="flow-line line-one"></div><div className="flow-line line-two"></div><div className="flow-line line-three"></div>
            {equipment.map((e,i)=><button key={e.id} onClick={()=>setSelected(e.id)} className={`machine machine-${e.id} ${selected===e.id?'chosen':''}`}><div className={`machine-icon ${e.state==='Предупреждение'?'warn':''}`}>{e.id==='tank'?<Droplets/>:e.id==='pasteurizer'?<Thermometer/>:e.id==='cooler'?<Activity/>:<Package/>}</div><b>{e.name}</b><small>{e.state}</small><span className="machine-load">{e.load}%</span></button>)}
            <div className="map-caption">СХЕМА ТЕХНОЛОГИЧЕСКОГО ПОТОКА</div>
          </div>
          <div className="equipment-detail"><div className="detail-head"><div><span className="eyebrow">ВЫБРАННОЕ ОБОРУДОВАНИЕ</span><h4>{activeEquipment.name}</h4></div><span className={`state ${activeEquipment.state==='Предупреждение'?'state-warn':''}`}><i></i>{activeEquipment.state}</span></div><p>{activeEquipment.sub}</p><div className="detail-stats"><div><span>Температура</span><b>{activeEquipment.temp}</b></div><div><span>Загрузка</span><b>{activeEquipment.load}%</b></div><div><span>Состояние</span><b>{activeEquipment.state}</b></div></div><div className="detail-recommend"><Lightbulb size={17}/><span>{activeEquipment.state==='Предупреждение'?'Проверьте доступность фасовочной линии и перераспределите партии.':'Параметры находятся в допустимом демонстрационном диапазоне.'}</span></div><div className="equipment-list">{equipment.map(e=><button key={e.id} onClick={()=>setSelected(e.id)} className={selected===e.id?'chosen':''}><span className={`mini-status ${e.state==='Предупреждение'?'red':''}`}></span>{e.name}<span>{e.load}%</span></button>)}</div></div>
        </div>
      </section>

      <div className="bottom-grid">
        <section className="panel" id="recommendations"><div className="panel-head"><div><h3>Рекомендации системы</h3><p>Расчётное сравнение вариантов работы</p></div><ShieldCheck size={19} color="#37a987"/></div><div className="recommend-item"><div className="rec-icon"><Leaf/></div><div><b>Оптимизация энергопотребления</b><p>Рекомендуемый режим позволяет снизить расчётный расход энергии без изменения объёма выпуска.</p></div><span className="rec-value">−{data?.recommended?.energy_saving_pct ?? 4}%</span></div><div className="recommend-item"><div className="rec-icon blue"><Droplets/></div><div><b>Контроль расхода воды</b><p>Планируйте мойку оборудования между партиями и отслеживайте расход по интервалам.</p></div><span className="rec-value blue-text">−3%</span></div><div className="recommend-item"><div className="rec-icon amber"><Gauge/></div><div><b>Контроль загрузки линии</b><p>{load>90?'Высокая загрузка: проверьте, не превышены ли ограничения оборудования.':'Сохраняйте загрузку в допустимом диапазоне технологической карты.'}</p></div><span className="rec-value amber-text">{load}%</span></div></section>
        <section className="panel model-panel"><div className="panel-head"><div><h3>Качество прогнозирования</h3><p>Сравнение моделей · учебный результат</p></div><span className="model-tag">ML</span></div><div className="model-row header"><span>Модель</span><span>MAE</span><span>RMSE</span><span>R²</span></div>{[['Базовый прогноз','12.8','16.4','0.71'],['Линейная регрессия','9.6','12.7','0.82'],['Случайный лес','6.3','8.9','0.91'],['LSTM (пример)','7.1','9.8','0.88']].map((r,i)=><div className={`model-row ${i===2?'best':''}`} key={r[0]}><span>{r[0]}{i===2&&<i>ЛУЧШАЯ</i>}</span><span>{r[1]}</span><span>{r[2]}</span><span>{r[3]}</span></div>)}<div className="model-note"><AlertTriangle size={14}/> Демонстрационные значения. Запустите Python-обучение в папке ml для расчёта метрик по сгенерированному датасету.</div></section>
      </div>

      <footer><span>© 2026 DairyMind · Учебный прототип интеллектуальной системы</span><span><span className="live-dot"></span> {apiState==='api'?'API подключено':'Локальный режим'} · Только симуляция</span></footer>
    </main>
  </div>;
}

function Metric({icon,label,value,unit,trend,good,warning}) {
  return <div className="metric-card"><div className="metric-top"><div className="metric-icon">{icon}</div><span className={`metric-trend ${warning?'warn':good?'good':''}`}>{good?<ArrowDownRight size={13}/>:warning?<AlertTriangle size={13}/>:null}{trend}</span></div><div className="metric-label">{label}</div><div className="metric-value">{value}<small>{unit}</small></div></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
