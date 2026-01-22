'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    RefreshCcw,
    TrendingUp,
    Settings,
    CreditCard,
    LayoutDashboard,
    Table,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ComposedChart,
    Line
} from 'recharts';

export default function ForecastPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    // Filters & Simulation Options
    const [selectedAccount, setSelectedAccount] = useState('all');
    const [lookbackDays, setLookbackDays] = useState(30);
    const [adjustmentFactor, setAdjustmentFactor] = useState(1.0); // 1.0 = 100%
    const [additionalFixedCost, setAdditionalFixedCost] = useState(0);
    const [period, setPeriod] = useState<'current_month' | 'next_month' | 'next_quarter'>('current_month');

    const [data, setData] = useState<any>(null); // ForecastResult

    useEffect(() => {
        loadAccounts();
    }, []);

    useEffect(() => {
        calculateForecast();
    }, [selectedAccount, lookbackDays, adjustmentFactor, additionalFixedCost, period]);

    const loadAccounts = async () => {
        if (window.electron) {
            const accs = await window.electron.getAccounts();
            setAccounts(accs);
        }
    };

    const calculateForecast = async () => {
        if (window.electron) {
            setLoading(true);
            try {
                const result = await window.electron.calculateDetailedForecast({
                    accountId: selectedAccount,
                    options: {
                        lookbackDays,
                        adjustmentFactor,
                        additionalFixedCost,
                        period
                    }
                });
                setData(result);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleCopy = () => {
        if (!data) return;
        const header = ['Date', 'Type', 'Amount (USD)'].join('\t');
        const rows = [
            ...data.history.map((h: any) => [h.date, 'Actual', h.amount.toFixed(2)].join('\t')),
            ...data.forecast.map((f: any) => [f.date, 'Forecast', f.amount.toFixed(2)].join('\t'))
        ].join('\n');

        navigator.clipboard.writeText(`${header}\n${rows}`);
        alert('クリップボードにコピーしました (TSV)');
    };

    // Prepare chart data with proper connection
    let chartData: any[] = [];
    if (data) {
        // 1. Add History (Actuals)
        chartData = data.history.map((h: any) => ({
            date: h.date,
            actual: h.amount,
            forecast: null
        }));

        // 2. Add Connection Point (Last Actual = First Forecast Start)
        if (data.history.length > 0 && data.forecast.length > 0) {
            const lastHistory = data.history[data.history.length - 1];
            const lastPointIndex = chartData.length - 1;
            chartData[lastPointIndex] = {
                ...chartData[lastPointIndex],
                forecast: lastHistory.amount
            };
        }

        // 3. Add Forecast (Future)
        data.forecast.forEach((f: any) => {
            chartData.push({
                date: f.date,
                actual: null,
                forecast: f.amount
            });
        });
    }

    const formatCurrency = (val: number) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="">
            <div className="max-w-7xl mx-auto flex gap-8">
                <main className="w-full">
                    <header className="mb-8">
                        <div className="flex items-center gap-2 text-blue-400 font-medium mb-1 uppercase tracking-wider text-xs">
                            <TrendingUp size={14} />
                            <span>Forecast Simulation</span>
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">着地見込シミュレーション</h1>
                        <p className="text-slate-400 text-sm">過去の傾向と変動要因に基づき、今月の着地見込を試算します。</p>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left: Simulation Controls & Summary */}
                        <div className="space-y-6">
                            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Settings size={18} className="text-slate-400" />
                                    パラメータ設定
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">対象アカウント</label>
                                        <select
                                            value={selectedAccount}
                                            onChange={(e) => setSelectedAccount(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5"
                                        >
                                            <option value="all">全アカウント</option>
                                            {accounts.map((acc) => (
                                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">参照期間 (日次平均算出用)</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[7, 14, 30, 60].map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => setLookbackDays(d)}
                                                    className={`py-2 px-1 rounded-lg text-xs font-bold transition-all border ${lookbackDays === d
                                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                                                        }`}
                                                >
                                                    過去{d}日
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">
                                            変動係数 (季節性など)
                                            <span className="ml-2 text-blue-400">x{adjustmentFactor.toFixed(2)}</span>
                                        </label>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="2.0"
                                            step="0.05"
                                            value={adjustmentFactor}
                                            onChange={(e) => setAdjustmentFactor(parseFloat(e.target.value))}
                                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                                            <span>50%</span>
                                            <span>100%</span>
                                            <span>200%</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">追加固定費 (USD)</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">$</div>
                                            <input
                                                type="number"
                                                value={additionalFixedCost}
                                                onChange={(e) => setAdditionalFixedCost(parseFloat(e.target.value) || 0)}
                                                className="pl-7 w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-800">
                                        <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">予測対象期間</label>
                                        <select
                                            value={period}
                                            onChange={(e) => setPeriod(e.target.value as any)}
                                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5"
                                        >
                                            <option value="current_month">今月 (残期間)</option>
                                            <option value="next_month">翌月 (1ヶ月)</option>
                                            <option value="next_quarter">来四半期 (3ヶ月)</option>
                                        </select>
                                    </div>

                                    <button
                                        onClick={handleCopy}
                                        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all font-medium text-sm"
                                    >
                                        <Table size={16} />
                                        データコピー (TSV)
                                    </button>
                                </div>
                            </div>

                            {/* Summary Card */}
                            {data && (
                                <div className="bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border border-blue-500/30 rounded-2xl p-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

                                    <h3 className="text-sm font-medium text-blue-200 mb-1">今月の着地見込 (Predicted)</h3>
                                    <p className="text-4xl font-bold text-white mb-4 tracking-tight">
                                        {formatCurrency(data.totalPredicted)}
                                    </p>

                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between text-slate-300">
                                            <span>現在までの実績:</span>
                                            <span className="font-medium">{formatCurrency(data.currentTotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-300">
                                            <span>予想残コスト:</span>
                                            <span className="font-medium text-blue-300">+{formatCurrency(data.totalPredicted - data.currentTotal)}</span>
                                        </div>
                                        <div className="pt-2 border-t border-blue-500/20 flex justify-between items-center mt-2">
                                            <span className="text-slate-300">予算 ({formatCurrency(data.budget)}):</span>
                                            <span className={`font-bold px-2 py-0.5 rounded ${data.totalPredicted > data.budget
                                                ? 'bg-rose-500/20 text-rose-400'
                                                : 'bg-emerald-500/20 text-emerald-400'
                                                }`}>
                                                {data.totalPredicted > data.budget ? '予算超過' : '予算内'}
                                                {' '}({Math.round((data.totalPredicted / data.budget) * 100)}%)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: Chart */}
                        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col h-[500px]">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-lg font-bold text-white">日次コスト推移と予測</h2>
                                {loading && <span className="text-xs text-blue-400 animate-pulse">計算中...</span>}
                            </div>

                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorHistory" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#475569"
                                            fontSize={12}
                                            tickFormatter={(val) => {
                                                const d = new Date(val);
                                                return `${d.getMonth() + 1}/${d.getDate()}`;
                                            }}
                                        />
                                        <YAxis
                                            stroke="#475569"
                                            fontSize={12}
                                            tickFormatter={(val) => `$${val}`}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#0f172a',
                                                border: '1px solid #1e293b',
                                                borderRadius: '12px',
                                            }}
                                            itemStyle={{ color: '#f8fafc' }}
                                            labelFormatter={(label) => new Date(label as string).toLocaleDateString()}
                                            formatter={(value: any, name: any, props: any) => {
                                                const label = name === 'actual' ? '実績' : '予測';
                                                return [`$${Number(value).toFixed(2)}`, label];
                                            }}
                                        />

                                        {/* Actuals Line */}
                                        <Area
                                            type="monotone"
                                            dataKey="actual"
                                            stroke="#3b82f6"
                                            strokeWidth={3}
                                            fill="url(#colorHistory)"
                                        />

                                        {/* Forecast Line */}
                                        <Area
                                            type="monotone"
                                            dataKey="forecast"
                                            stroke="#8b5cf6"
                                            strokeWidth={3}
                                            strokeDasharray="5 5"
                                            fill="url(#colorForecast)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}


