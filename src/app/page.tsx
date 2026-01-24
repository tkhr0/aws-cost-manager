'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Download,
  RefreshCcw,
  LayoutDashboard,
  Settings,
  CreditCard,
  TrendingUp,
  AlertCircle,
  Table,
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  // Filters
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedAccount]);

  useEffect(() => {
    loadAvailableMonths();
  }, [selectedAccount]);

  const loadData = async () => {
    if (window.electron) {
      console.log(`[Dashboard] Loading data for Account: ${selectedAccount}, Month: ${selectedMonth}`);
      try {
        const accs = await window.electron.getAccounts();
        setAccounts(accs);

        // Load dashboard data with filters
        const data = await window.electron.getDashboardData({
          accountId: selectedAccount,
          month: selectedMonth
        });
        console.log('[Dashboard] Received data:', data);
        setDashboardData(data);

        // Transform records to chart data
        if (data.records && data.records.length > 0) {
          const chartPoints = data.records.map((r: any) => ({
            name: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            amount: r.amount,
          }));
          setChartData(chartPoints);
        }
      } catch (err: any) {
        console.error('[Dashboard] Error loading data:', err);
        setStatus(`Error loading data: ${err.message}`);
      }
    }
  };

  const handleSync = async () => {
    if (accounts.length === 0) {
      setStatus('アカウントが設定されていません。設定から追加してください。');
      return;
    }

    try {
      setLoading(true);
      setStatus('AWS Cost Explorerと同期中...');

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endDate = now.toISOString().split('T')[0];

      const result = await window.electron.syncCosts({
        accountId: accounts[0].accountId,
        profileName: accounts[0].profileName,
        startDate,
        endDate,
      });

      setStatus(`${result.daysSynced}日分のデータを同期しました。`);

      // Reload dashboard data
      await loadData();
    } catch (e: any) {
      setStatus(`エラー: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (accounts.length === 0) {
      setStatus('アカウントが設定されていません。');
      return;
    }
    try {
      const result = await window.electron.exportCsv({ accountId: accounts[0].id });
      if (result.success) {
        setStatus(`${result.filePath} に出力しました。`);
      }
    } catch (e: any) {
      setStatus(`出力エラー: ${e.message}`);
    }
  };

  const loadAvailableMonths = async () => {
    if (window.electron) {
      try {
        const months = await window.electron.getAvailableMonths({ accountId: selectedAccount });
        if (months && months.length > 0) {
          setAvailableMonths(months);
          if (!months.includes(selectedMonth)) {
            setSelectedMonth(months[0]);
          }
        } else {
          const fallbackMonths = Array.from({ length: 12 }).map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          });
          setAvailableMonths(fallbackMonths);
        }
      } catch (e) {
        console.error('Failed to load available months', e);
      }
    }
  };

  const totalActual = dashboardData?.records?.reduce((sum: number, r: any) => sum + r.amount, 0) || 0;
  const budget = dashboardData?.budget || 0;
  const forecast = dashboardData?.forecast || 0;
  const exchangeRate = dashboardData?.exchangeRate || 150;

  const remaining = budget > 0 ? budget - totalActual : 0;
  const isOverBudget = budget > 0 && forecast > budget;

  const formatJpy = (usd: number) => `¥${Math.round(usd * exchangeRate).toLocaleString()}`;

  return (
    <div className="">
      <main className="p-10 max-w-7xl mx-auto">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 text-blue-400 font-medium mb-1 uppercase tracking-wider text-xs">
              <TrendingUp size={14} />
              <span>リアルタイム財務状況</span>
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">
              クラウドコスト<span className="text-slate-500">分析</span>
            </h1>
            <p className="text-slate-400 mt-2 text-sm font-medium">
              {(() => {
                const [y, m] = selectedMonth.split('-');
                const start = new Date(parseInt(y), parseInt(m) - 1, 1);
                const end = new Date(parseInt(y), parseInt(m), 0);
                const formatDate = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
                return `${formatDate(start)} — ${formatDate(end)} (@${exchangeRate} JPY/USD)`;
              })()}
            </p>
          </div>

          <div className="flex gap-3 items-center">
            {/* Month Selector */}
            <select
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m.split('-')[0]}年{Number(m.split('-')[1])}月
                </option>
              ))}
            </select>

            {/* Account Selector */}
            <select
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              <option value="all">全アカウント</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all font-medium text-sm"
            >
              <Download size={16} />
              CSV出力
            </button>
            <button
              onClick={handleSync}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all font-medium text-sm disabled:opacity-50"
            >
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? '同期中...' : 'AWS同期'}
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="今月のコスト (実績)"
            value={`$${totalActual.toFixed(2)}`}
            subValue={formatJpy(totalActual)}
            trend={totalActual > 0 ? '+' : ''}
            trendUp
          />
          <StatCard
            title="今月の着地見込 (予測)"
            value={`$${forecast.toFixed(2)}`}
            subValue={formatJpy(forecast)}
            trend={isOverBudget ? '予算超過' : ''}
            trendUp={!isOverBudget}
            warning={isOverBudget}
          />
          <StatCard
            title="予算残高"
            value={`$${remaining.toFixed(2)}`}
            subValue={`月次予算: $${budget.toFixed(2)} (${formatJpy(budget)})`}
            trend={budget > 0 ? `${Math.round((totalActual / budget) * 100)}%` : '-'}
            isProgress
            progressColor={isOverBudget ? 'bg-red-500' : 'bg-blue-500'}
          />
        </div>

        {/* Main Chart */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-3xl shadow-2xl mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] -mr-32 -mt-32 rounded-full pointer-events-none transition-all duration-500" />

          <h2 className="text-xl font-bold text-white mb-6">日次コスト推移</h2>
          <div className="h-72 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#475569"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    stroke="#475569"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '12px',
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorAmount)"
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
                  <p>コストデータがありません</p>
                  <p className="text-sm mt-2">"AWS同期" ボタンで最新データを取得してください</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Service Breakdown Table */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-3xl shadow-2xl overflow-hidden">
          <h2 className="text-xl font-bold text-white mb-6">サービス別内訳</h2>
          <ServiceTable data={dashboardData?.serviceBreakdown || []} />
        </div>

        {status && (
          <div className="fixed bottom-10 right-10 max-w-sm animate-in fade-in slide-in-from-bottom-5">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-slate-300 text-sm font-medium">{status}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ServiceTable({ data }: { data: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs">
          <tr>
            <th className="p-4 rounded-tl-xl">サービス名</th>
            <th className="p-4 text-center">推移 (7日間)</th>
            <th className="p-4 text-right">コスト (USD)</th>
            <th className="p-4 text-right rounded-tr-xl">構成比</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {data.length === 0 ? (
            <tr><td colSpan={4} className="p-8 text-center text-slate-500">データがありません</td></tr>
          ) : (
            data.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-4 font-medium text-slate-200">{item.name}</td>
                <td className="p-4 h-16 w-32">
                  <div className="w-32 h-10 mx-auto">
                    <Sparkline data={item.sparkline} />
                  </div>
                </td>
                <td className="p-4 text-right font-bold text-white">
                  ${item.amount.toFixed(2)}
                </td>
                <td className="p-4 text-right text-slate-400">
                  {item.percentage.toFixed(1)}%
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  // Take last 7 days or all if less
  const recentData = data.slice(-7).map((val, i) => ({ i, val }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={recentData}>
        <Line type="monotone" dataKey="val" stroke="#10b981" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}



function StatCard({
  title,
  value,
  subValue,
  trend,
  trendUp = true,
  isProgress = false,
  warning = false,
  progressColor = 'bg-blue-500',
}: any) {
  return (
    <div className={`bg-slate-900/40 border ${warning ? 'border-red-500/50' : 'border-slate-800'} rounded-3xl p-6 backdrop-blur-3xl shadow-xl hover:border-slate-700 transition-all cursor-default relative overflow-hidden`}>
      {warning && (
        <div className="absolute top-0 right-0 p-4 opacity-20">
          <AlertCircle className="text-red-500" size={64} />
        </div>
      )}
      <p className="text-slate-400 text-sm font-medium mb-3">{title}</p>
      <div className="flex items-end justify-between mb-2">
        <p className={`text-4xl font-bold tracking-tight ${warning ? 'text-red-400' : 'text-white'}`}>{value}</p>
        {!isProgress && trend && (
          <span
            className={`px-2 py-1 rounded-lg text-xs font-bold ${warning ? 'bg-red-500/10 text-red-400' : (trendUp ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400')
              }`}
          >
            {trend}
          </span>
        )}
      </div>
      {isProgress ? (
        <div className="w-full h-1.5 bg-slate-800 rounded-full mt-4">
          <div className={`h-full rounded-full ${progressColor}`} style={{ width: trend }} />
        </div>
      ) : (
        <p className="text-slate-500 text-xs mt-1">{subValue}</p>
      )}
    </div>
  );
}

function InsightItem({ icon, text }: any) {
  return (
    <div className="flex gap-3 p-4 bg-slate-900/30 rounded-2xl border border-slate-800/50 hover:bg-slate-900/50 transition-all group">
      <div className="mt-0.5">{icon}</div>
      <p className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors leading-snug">
        {text}
      </p>
    </div>
  );
}
