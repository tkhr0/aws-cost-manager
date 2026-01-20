'use client';

import { useEffect, useState } from 'react';
import { Settings, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        accountId: '',
        profileName: '',
    });

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        if (window.electron) {
            const data = await window.electron.getAccounts();
            setAccounts(data);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (window.electron) {
            await window.electron.addAccount(formData);
            setFormData({ name: '', accountId: '', profileName: '' });
            setShowAddForm(false);
            loadAccounts();
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 p-10">
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => router.push('/')}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-8 transition-colors"
                >
                    <ArrowLeft size={20} />
                    ダッシュボードに戻る
                </button>

                <div className="flex items-center gap-3 mb-8">
                    <Settings className="text-blue-400" size={32} />
                    <h1 className="text-3xl font-bold text-white">設定</h1>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-3xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-white">AWSアカウント設定</h2>
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all text-sm font-medium"
                        >
                            <Plus size={16} />
                            アカウント追加
                        </button>
                    </div>

                    {showAddForm && (
                        <form onSubmit={handleAdd} className="mb-6 p-6 bg-slate-900/50 rounded-2xl border border-slate-800">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">アカウント表示名</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="例: 本番環境"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">AWSアカウントID</label>
                                    <input
                                        type="text"
                                        value={formData.accountId}
                                        onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="123456789012"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">AWSプロファイル名 (~/.aws/credentials)</label>
                                    <input
                                        type="text"
                                        value={formData.profileName}
                                        onChange={(e) => setFormData({ ...formData, profileName: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="default"
                                        required
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all font-medium"
                                    >
                                        保存
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddForm(false)}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all font-medium"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    <div className="space-y-3">
                        {accounts.length === 0 ? (
                            <p className="text-slate-400 text-center py-8">アカウントが設定されていません。</p>
                        ) : (
                            accounts.map((account) => (
                                <div
                                    key={account.id}
                                    className="flex items-center justify-between p-4 bg-slate-900/30 rounded-xl border border-slate-800 hover:bg-slate-900/50 transition-all"
                                >
                                    <div>
                                        <h3 className="font-semibold text-white">{account.name}</h3>
                                        <p className="text-sm text-slate-400">Account ID: {account.accountId}</p>
                                        <p className="text-sm text-slate-500">Profile: {account.profileName}</p>
                                    </div>
                                    <button
                                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                                        title="Delete account"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Debug Tools */}
                <div className="mt-8 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-3xl">
                    <h2 className="text-xl font-semibold text-white mb-4">デバッグツール</h2>
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-between">
                        <div>
                            <p className="text-yellow-200 font-medium">ダミーデータ生成</p>
                            <p className="text-sm text-yellow-500/80 mt-1">
                                デモ用アカウントを作成し、過去30日分のサンプルデータを投入します。
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                if (confirm('ダミーデータを投入します。よろしいですか？')) {
                                    if (window.electron) {
                                        await window.electron.generateDummyData();
                                        loadAccounts();
                                        alert('ダミーデータを生成しました！');
                                    }
                                }
                            }}
                            className="px-4 py-2 bg-yellow-600/20 text-yellow-400 border border-yellow-600/50 rounded-lg hover:bg-yellow-600/30 transition-all text-sm font-medium"
                        >
                            データ生成
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
