'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    CreditCard,
    TrendingUp,
    Table,
    Settings,
} from 'lucide-react';

export default function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <div className="hidden lg:flex fixed left-0 top-0 h-full w-20 bg-slate-900/50 border-r border-slate-800 flex-col items-center py-8 gap-8 z-50">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <LayoutDashboard size={24} className="text-white" />
            </div>
            <nav className="flex flex-col gap-6">
                <button onClick={() => router.push('/')} title="ダッシュボード">
                    <NavItem icon={<CreditCard size={20} />} active={pathname === '/'} />
                </button>
                <button onClick={() => router.push('/forecast')} title="予測シミュレーション">
                    <NavItem icon={<TrendingUp size={20} />} active={pathname === '/forecast'} />
                </button>
                <button onClick={() => router.push('/analytics')} title="詳細分析">
                    <NavItem icon={<Table size={20} />} active={pathname === '/analytics'} />
                </button>
                <button onClick={() => router.push('/settings')} title="設定">
                    <NavItem icon={<Settings size={20} />} active={pathname === '/settings'} />
                </button>
            </nav>
        </div>
    );
}

function NavItem({ icon, active = false }: { icon: React.ReactNode; active?: boolean }) {
    return (
        <div
            className={`p-3 rounded-xl cursor-pointer transition-all ${active ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                }`}
        >
            {icon}
        </div>
    );
}
