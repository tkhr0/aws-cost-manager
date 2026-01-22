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

    const [editingAccount, setEditingAccount] = useState<any>(null);
    const [editFormData, setEditFormData] = useState({
        id: '',
        budget: 0,
        exchangeRate: 150,
        profileName: '',
    });

    const handleEditClick = (account: any) => {
        setEditingAccount(account);
        setEditFormData({
            id: account.id,
            budget: account.budget || 0,
            exchangeRate: account.exchangeRate || 150,
            profileName: account.profileName || '',
        });
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (window.electron && editingAccount) {
            await window.electron.updateAccountSettings({
                id: editFormData.id,
                budget: parseFloat(String(editFormData.budget)),
                exchangeRate: parseFloat(String(editFormData.exchangeRate)),
                profileName: editFormData.profileName,
            });
            setEditingAccount(null);
            loadAccounts();
        }
    };

    return (
        <div className="p-10">
            <div className="max-w-4xl mx-auto">

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

                    {/* Add Form (Existing) */}
                    {showAddForm && (
                        <form onSubmit={handleAdd} className="mb-6 p-6 bg-slate-900/50 rounded-2xl border border-slate-800">
                            <h3 className="text-lg font-medium text-white mb-4">新規アカウント追加</h3>
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
                                    <label className="block text-sm font-medium text-slate-300 mb-2">AWSプロファイル名 (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.profileName}
                                        onChange={(e) => setFormData({ ...formData, profileName: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="default (空欄なら環境変数を使用)"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all font-medium"
                                    >
                                        追加
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

                    {/* Edit Form (Overlay or Inline?) - Let's use inline for simplicity replacement of the list item or modal */}
                    {/* Implementing as Modal Overlay would be nicer UI but inline expansion is easier with current structure. */}
                    {/* Let's try a Modal Overlay for Edit */}
                    {editingAccount && (
                        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-[#0b1221] border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                                <h3 className="text-xl font-bold text-white mb-6">設定変更: {editingAccount.name}</h3>
                                <form onSubmit={handleUpdate} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">月次予算 (USD, 税抜)</label>
                                        <input
                                            type="number"
                                            value={editFormData.budget}
                                            onChange={(e) => setEditFormData({ ...editFormData, budget: parseFloat(e.target.value) })}
                                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">参考為替レート (JPY/USD)</label>
                                        <input
                                            type="number"
                                            value={editFormData.exchangeRate}
                                            onChange={(e) => setEditFormData({ ...editFormData, exchangeRate: parseFloat(e.target.value) })}
                                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            min="1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">AWSプロファイル名 (Optional)</label>
                                        <input
                                            type="text"
                                            value={editFormData.profileName}
                                            onChange={(e) => setEditFormData({ ...editFormData, profileName: e.target.value })}
                                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="default (空欄なら環境変数を使用)"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">空欄の場合、環境変数 (AWS_ACCESS_KEY_ID等) が使用されます。</p>
                                    </div>

                                    <div className="flex justify-end gap-3 mt-6">
                                        <button
                                            type="button"
                                            onClick={() => setEditingAccount(null)}
                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all font-medium"
                                        >
                                            キャンセル
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all font-medium"
                                        >
                                            保存
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {accounts.length === 0 ? (
                            <p className="text-slate-400 text-center py-8">アカウントが設定されていません。</p>
                        ) : (
                            accounts.map((account) => (
                                <div
                                    key={account.id}
                                    className="flex items-center justify-between p-4 bg-slate-900/30 rounded-xl border border-slate-800 hover:bg-slate-900/50 transition-all group"
                                >
                                    <div>
                                        <h3 className="font-semibold text-white flex items-center gap-3">
                                            {account.name}
                                            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                                {account.accountId}
                                            </span>
                                        </h3>
                                        <div className="text-sm text-slate-400 mt-1 flex gap-4">
                                            <span>Profile: <span className="text-slate-200">{account.profileName || '(Env Vars)'}</span></span>
                                            <span>Budget: <span className="text-slate-200">${account.budget}</span></span>
                                            <span>Rate: <span className="text-slate-200">¥{account.exchangeRate}</span></span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEditClick(account)}
                                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all"
                                            title="Edit settings"
                                        >
                                            <Settings size={18} />
                                        </button>
                                        <button
                                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                                            title="Delete account"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
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
