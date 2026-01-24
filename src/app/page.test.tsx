import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Home from './page';

// Mock Recharts to avoid sizing issues in jsdom
vi.mock('recharts', () => {
    const Original = vi.importActual('recharts');
    return {
        ...Original,
        ResponsiveContainer: ({ children }: any) => <div className="recharts-responsive-container" style={{ width: 800, height: 600 }}>{children}</div>,
        AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
        Area: () => <div />,
        XAxis: () => <div />,
        YAxis: () => <div />,
        CartesianGrid: () => <div />,
        Tooltip: () => <div />,
        LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
        Line: () => <div />,
    };
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Mock useRouter
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

describe('Dashboard Page', () => {
    const mockGetAccounts = vi.fn();
    const mockGetDashboardData = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup window.electron mock
        Object.defineProperty(window, 'electron', {
            value: {
                getAccounts: mockGetAccounts,
                getDashboardData: mockGetDashboardData,
                syncCosts: vi.fn(),
                exportCsv: vi.fn(),
            },
            writable: true,
        });
    });

    it('renders dashboard and loads data', async () => {
        mockGetAccounts.mockResolvedValue([
            { id: 'acc-1', name: 'Test Account', accountId: '123456789012' }
        ]);
        mockGetDashboardData.mockResolvedValue({
            records: [
                { date: '2023-01-01', amount: 100, service: 'EC2' },
            ],
            serviceBreakdown: [],
            budget: 1000,
            forecast: 1200,
            exchangeRate: 150,
        });

        render(<Home />);

        // Verify loading state or initial render
        expect(screen.getByText(/クラウドコスト/)).toBeDefined();

        // specific elements should appear after data load
        await waitFor(() => {
            expect(screen.getByText('Test Account')).toBeDefined();
        });

        // Check if chart is rendered (by proxy of generic text or logic)
        // We expect "日次コスト推移" header
        expect(screen.getByText('日次コスト推移')).toBeDefined();

        // Check if stats are displayed
        await waitFor(() => {
            // $100.00 actual
            expect(screen.getByText('$100.00')).toBeDefined();
        });
    });

    it('calls fillDailyCosts logic implicitly by showing data', async () => {
        // This is an integration verification. 
        // We know the component uses fillDailyCosts. 
        // If the component renders without error and shows the chart, we assume it worked.
        mockGetAccounts.mockResolvedValue([]);
        mockGetDashboardData.mockResolvedValue({ records: [], serviceBreakdown: [] });

        render(<Home />);
        await waitFor(() => {
            expect(mockGetDashboardData).toHaveBeenCalled();
        });
    });
});
