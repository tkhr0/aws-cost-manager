'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    RefreshCcw,
    Download,
    Filter,
    Table,
} from 'lucide-react';

export default function AnalyticsPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    // Filters
    const [selectedAccount, setSelectedAccount] = useState('all');
    const [granularity, setGranularity] = useState<'monthly' | 'daily'>('monthly');
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    const [targetMonth, setTargetMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    // Data
    const [data, setData] = useState<any>(null); // { headers: string[], rows: any[] }

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'total', direction: 'desc' });

    useEffect(() => {
        loadAccounts();
        loadAvailableMonths();
    }, []);

    useEffect(() => {
        loadAnalyticsData();
        // loadAvailableMonths(); // Removed to avoid infinite loop or duplicate calls if not needed on every dependency change.
        // Actually, if account changes, available months might change?
        // Let's keep it but maybe only on account change?
        // For simplicity, let's just load it on mount and maybe account change.
        if (selectedAccount !== 'all') {
            loadAvailableMonths();
        }
    }, [selectedAccount, granularity, targetMonth]);

    const loadAvailableMonths = async () => {
        if (window.electron) {
            try {
                const months = await window.electron.getAvailableMonths({ accountId: selectedAccount });
                if (months && months.length > 0) {
                    setAvailableMonths(months);
                    if (!months.includes(targetMonth)) {
                        setTargetMonth(months[0]);
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

    const loadAccounts = async () => {
        if (window.electron) {
            const accs = await window.electron.getAccounts();
            setAccounts(accs);
        }
    };

    const loadAnalyticsData = async () => {
        if (window.electron) {
            setLoading(true);
            try {
                const [y, m] = targetMonth.split('-');
                const result = await window.electron.getAnalyticsData({
                    accountId: selectedAccount,
                    year: y,
                    month: m,
                    granularity,
                });
                setData(result);
            } catch (error: any) {
                setStatus(`取得エラー: ${error.message}`);
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const sortedRows = (() => {
        if (!data?.rows) return [];
        return [...data.rows].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            // Handle undefined/null
            if (aVal === undefined && bVal === undefined) return 0;
            if (aVal === undefined) return 1;
            if (bVal === undefined) return -1;

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            }
            // String comparison
            const result = String(aVal).localeCompare(String(bVal));
            return sortConfig.direction === 'asc' ? result : -result;
        });
    })();

    const handleExport = () => {
        // Simple CSV export for now
        // TODO: Implement proper CSV export via Electron for pivot data if needed
        alert('CSV export for detailed view is coming soon.');
    };

    return (
        <div className="font-sans p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Table className="text-blue-400" />
                            詳細分析
                        </h1>
                        <p className="text-slate-400 mt-1 text-sm">
                            コストデータを表形式で詳細に分析します。列ヘッダーをクリックしてソート可能です。
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-slate-800">
                            <button
                                onClick={() => setGranularity('monthly')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${granularity === 'monthly' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                月次
                            </button>
                            <button
                                onClick={() => setGranularity('daily')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${granularity === 'daily' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                日次
                            </button>
                        </div>

                        <button
                            onClick={loadAnalyticsData}
                            className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all"
                            title="再読み込み"
                        >
                            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </header>

                <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-3xl shadow-xl">
                    <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-slate-800">
                        {/* Filters */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">アカウント</label>
                            <select
                                value={selectedAccount}
                                onChange={(e) => setSelectedAccount(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-48 p-2.5"
                            >
                                <option value="all">全アカウント</option>
                                {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">対象月</label>
                            <select
                                value={targetMonth}
                                onChange={(e) => setTargetMonth(e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-40 p-2.5"
                            >
                                {availableMonths.map((m) => (
                                    <option key={m} value={m}>
                                        {m.split('-')[0]}年{Number(m.split('-')[1])}月
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="ml-auto self-end">
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all font-medium text-sm"
                            >
                                <Download size={16} />
                                CSV
                            </button>
                            <button
                                onClick={() => {
                                    if (!data?.rows) return;
                                    const header = ['Service', 'Total', ...data.headers, 'MoM $', 'MoM %'].join('\t');
                                    const body = sortedRows.map((r: any) => [
                                        r.service,
                                        r.total.toFixed(2),
                                        ...data.headers.map((h: string) => r[h] !== undefined ? Number(r[h]).toFixed(2) : ''),
                                        r.momAmount?.toFixed(2) || '0',
                                        r.momPercentage?.toFixed(1) || '0'
                                    ].join('\t')).join('\n');
                                    navigator.clipboard.writeText(`${header}\n${body}`);
                                    alert('クリップボードにコピーしました (TSV)');
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all font-medium text-sm ml-2"
                            >
                                <Table size={16} />
                                コピー
                            </button>
                        </div>
                    </div>

                    {/* Pivot Table */}
                    <div className="overflow-x-auto relative rounded-xl border border-slate-800">
                        <table className="w-full text-sm text-left text-slate-400">
                            <thead className="text-xs text-slate-300 uppercase bg-slate-900 sticky top-0 z-10">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-6 py-4 sticky left-0 bg-slate-900 border-r border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] z-20 w-64 min-w-[16rem] cursor-pointer hover:bg-slate-800/80 transition-colors"
                                        onClick={() => handleSort('service')}
                                    >
                                        <div className="flex items-center gap-1">
                                            サービス名
                                            {sortConfig.key === 'service' && (
                                                <span className="text-blue-400 text-[10px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                                            )}
                                        </div>
                                    </th>
                                    {granularity === 'daily' && (
                                        <th
                                            scope="col"
                                            className="px-6 py-4 text-right bg-slate-900 border-r border-slate-800 font-bold text-white cursor-pointer hover:bg-slate-800/80 transition-colors"
                                            onClick={() => handleSort('total')}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                合計 (USD)
                                                {sortConfig.key === 'total' && (
                                                    <span className="text-blue-400 text-[10px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                                                )}
                                            </div>
                                        </th>
                                    )}
                                    {data?.headers.map((header: string) => (
                                        <th
                                            key={header}
                                            scope="col"
                                            className="px-6 py-4 text-right min-w-[8rem] whitespace-nowrap cursor-pointer hover:bg-slate-800/80 transition-colors"
                                            onClick={() => handleSort(header)}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                {header}
                                                {sortConfig.key === header && (
                                                    <span className="text-blue-400 text-[10px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                    <th
                                        scope="col"
                                        className="px-6 py-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-800/80 transition-colors"
                                        onClick={() => handleSort('momAmount')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            前月比 ($)
                                            {sortConfig.key === 'momAmount' && (
                                                <span className="text-blue-400 text-[10px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-6 py-4 text-right whitespace-nowrap cursor-pointer hover:bg-slate-800/80 transition-colors"
                                        onClick={() => handleSort('momPercentage')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            前月比 (%)
                                            {sortConfig.key === 'momPercentage' && (
                                                <span className="text-blue-400 text-[10px]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                                            )}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 bg-slate-900/20">
                                {!data || data.rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={(data?.headers.length || 0) + (granularity === 'daily' ? 3 : 2)} className="px-6 py-12 text-center text-slate-500">
                                            {loading ? '読み込み中...' : 'データがありません'}
                                        </td>
                                    </tr>
                                ) : (
                                    sortedRows.map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-slate-800/50 transition-colors group">
                                            <th scope="row" className="px-6 py-3 font-medium text-slate-200 whitespace-nowrap sticky left-0 bg-[#0b1221] group-hover:bg-[#162032] border-r border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] z-10">
                                                <div className="truncate w-60" title={row.service}>
                                                    {row.service}
                                                </div>
                                            </th>
                                            {granularity === 'daily' && (
                                                <td className="px-6 py-3 text-right font-bold text-white border-r border-slate-800">
                                                    ${row.total.toFixed(2)}
                                                </td>
                                            )}
                                            {data.headers.map((header: string) => (
                                                <td key={header} className="px-6 py-3 text-right">
                                                    {row[header] !== undefined
                                                        ? `$${Number(row[header]).toFixed(2)}`
                                                        : <span className="text-slate-700">-</span>}
                                                </td>
                                            ))}
                                            <td className={`px-6 py-3 text-right ${row.momAmount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {row.momAmount > 0 ? '+' : ''}{row.momAmount?.toFixed(2)}
                                            </td>
                                            <td className={`px-6 py-3 text-right ${row.momAmount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {row.momAmount > 0 ? '+' : ''}{row.momPercentage?.toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
