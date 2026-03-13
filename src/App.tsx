/**
 * StatisticsPage.tsx
 * 통계 및 리포트 — Meta Ads 광고 성과 대시보드
 *
 * Supabase RPC (growthplatform) 직접 호출
 * RPC: digo_ad_kpi, digo_ad_daily, digo_ad_monthly, digo_ad_compare
 *
 * @route /admin/statistics
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Target,
  DollarSign,
  ShoppingCart,
  Eye,
  MousePointerClick,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  PieChart as PieChartIcon,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';


// ── Supabase Config ──────────────────────────────────
const SUPABASE_URL = 'https://ihzttwgqahhzlrqozleh.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloenR0d2dxYWhoemxycW96bGVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1Nzc4ODYsImV4cCI6MjA2NTE1Mzg4Nn0.RCa4oahcW4grLkRdW33tph0LJfwwIL7RPe87smUZTmo';

async function rpc<T = unknown>(fn: string, params: Record<string, unknown> = {}): Promise<T | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    console.error(`RPC ${fn} error:`, e);
    return null;
  }
}

// ── Types ────────────────────────────────────────────
interface KpiData {
  kpi: {
    spend: number;
    revenue: number;
    purchases: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpa: number;
    aov: number;
    roas: number;
  };
  period: { from: string; to: string; days: number };
  vs_prev: {
    spend_change: number | null;
    purchases_change: number | null;
    revenue_change: number | null;
  };
}

interface DailyRow {
  stat_date: string;
  client_code: string;
  cost: number;
  conversion_value: number;
  conversions: number;
  impressions: number;
  clicks: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

interface MonthlyRow {
  year_month: string;
  client_code: string;
  days: number;
  spend: number;
  revenue: number;
  purchases: number;
  impressions: number;
  clicks: number;
  avg_cpc: number;
  avg_cpa: number;
  avg_aov: number;
  roas: number;
}

interface CompareRow {
  client_code: string;
  days: number;
  spend: number;
  revenue: number;
  purchases: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpa: number;
  aov: number;
  roas: number;
}

// ── Helpers ──────────────────────────────────────────
function fmt(n: number | null | undefined, type: 'won' | 'roas' | 'comma' | 'pct' = 'comma'): string {
  if (n == null) return '-';
  if (type === 'won') {
    if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
    if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`;
    return `₩${Math.round(n).toLocaleString()}`;
  }
  if (type === 'roas') return `${Number(n).toFixed(2)}x`;
  if (type === 'pct') return `${Number(n).toFixed(1)}%`;
  return Math.round(n).toLocaleString();
}

const CHART_COLORS = {
  blue: '#4F6AFF',
  green: '#22C55E',
  amber: '#F59E0B',
  purple: '#8B5CF6',
  red: '#EF4444',
  teal: '#14B8A6',
};

const PERIODS = [
  { label: '전체 기간', from: '2025-01-01', to: '2026-03-10' },
  { label: '2026년 YTD', from: '2026-01-01', to: '2026-03-10' },
  { label: '2025년', from: '2025-01-01', to: '2025-12-31' },
  { label: '2025 Q4', from: '2025-10-01', to: '2025-12-31' },
  { label: '2025 Q3', from: '2025-07-01', to: '2025-09-30' },
];

// ── Tooltip Component ────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="text-gray-500 font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-600">{p.name}</span>
          <span className="ml-auto font-semibold text-gray-900">
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────
interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: keyof typeof colorMap;
  change?: number | null;
}

const colorMap = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'bg-blue-100' },
  green: { bg: 'bg-green-50', text: 'text-green-600', icon: 'bg-green-100' },
  amber: { bg: 'bg-yellow-50', text: 'text-yellow-600', icon: 'bg-yellow-100' },
  red: { bg: 'bg-red-50', text: 'text-red-600', icon: 'bg-red-100' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'bg-purple-100' },
};

function AdKpiCard({ title, value, subtitle, icon, color, change }: KpiCardProps) {
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow flex-1 min-w-[160px]">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
          {change != null && (
            <div className="mt-2 flex items-center text-xs">
              {change > 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-green-500 mr-0.5" />
              ) : change < 0 ? (
                <ArrowDownRight className="w-3.5 h-3.5 text-red-500 mr-0.5" />
              ) : (
                <Minus className="w-3.5 h-3.5 text-gray-400 mr-0.5" />
              )}
              <span className={change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'}>
                {Math.abs(change).toFixed(1)}% vs 이전
              </span>
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${c.icon}`}>{icon}</div>
      </div>
    </div>
  );
}

// ── Admin View ───────────────────────────────────────
function AdminView() {
  const [client, setClient] = useState('');
  const [periodIdx, setPeriodIdx] = useState(0);
  const [subtab, setSubtab] = useState<'daily' | 'monthly' | 'compare'>('daily');
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [compare, setCompare] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(true);

  const period = PERIODS[periodIdx];

  const load = useCallback(async () => {
    setLoading(true);
    const params = {
      p_client_code: client || null,
      p_date_from: period.from,
      p_date_to: period.to,
    };
    const [k, d, m, c] = await Promise.all([
      rpc<KpiData>('digo_ad_kpi', params),
      rpc<{ data: DailyRow[] }>('digo_ad_daily', params),
      rpc<{ data: MonthlyRow[] }>('digo_ad_monthly', { p_client_code: client || null, p_year: null }),
      rpc<{ data: CompareRow[] }>('digo_ad_compare', { p_date_from: period.from, p_date_to: period.to }),
    ]);
    setKpi(k);
    setDaily(d?.data || []);
    setMonthly(m?.data || []);
    setCompare(c?.data || []);
    setLoading(false);
  }, [client, period]);

  useEffect(() => { load(); }, [load]);

  const k = kpi?.kpi;
  const vs = kpi?.vs_prev;

  const dailyChart = useMemo(
    () =>
      daily.map((d) => ({
        date: d.stat_date.slice(5),
        '광고비(만)': Math.round(Number(d.cost) / 1e4),
        '매출(만)': Math.round(Number(d.conversion_value) / 1e4),
        구매: d.conversions,
        ROAS: Number(d.roas),
      })),
    [daily],
  );

  const monthlyChart = useMemo(
    () =>
      monthly.map((m) => ({
        month: m.year_month.slice(2),
        ...m,
        '광고비(만)': Math.round(Number(m.spend) / 1e4),
        '매출(만)': Math.round(Number(m.revenue) / 1e4),
      })),
    [monthly],
  );

  const interval = Math.max(0, Math.floor(dailyChart.length / 12));

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">전체 광고주</option>
          <option value="FCMM">FCMM (패션)</option>
          <option value="OZEC">오제끄 (뷰티)</option>
        </select>
        <select
          value={periodIdx}
          onChange={(e) => setPeriodIdx(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          {PERIODS.map((p, i) => (
            <option key={i} value={i}>{p.label}</option>
          ))}
        </select>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 transition">
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-400">
          {period.from} ~ {period.to} · {daily.length}일
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          <span className="ml-3 text-gray-500">데이터를 불러오는 중...</span>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <AdKpiCard title="총 광고비" value={fmt(k?.spend, 'won')} subtitle={`CPC ₩${fmt(k?.cpc)}`} icon={<DollarSign className="w-5 h-5 text-blue-600" />} color="blue" change={vs?.spend_change} />
            <AdKpiCard title="추정 매출" value={fmt(k?.revenue, 'won')} subtitle={`AOV ₩${fmt(k?.aov)}`} icon={<TrendingUp className="w-5 h-5 text-green-600" />} color="green" change={vs?.revenue_change} />
            <AdKpiCard title="구매 전환" value={fmt(k?.purchases)} subtitle={`CPA ₩${fmt(k?.cpa)}`} icon={<ShoppingCart className="w-5 h-5 text-yellow-600" />} color="amber" change={vs?.purchases_change} />
            <AdKpiCard title="ROAS" value={fmt(k?.roas, 'roas')} subtitle={`CTR ${k?.ctr || 0}%`} icon={<Target className="w-5 h-5 text-purple-600" />} color="purple" />
            <AdKpiCard title="노출" value={fmt(k?.impressions)} subtitle={`클릭 ${fmt(k?.clicks)}`} icon={<Eye className="w-5 h-5 text-red-600" />} color="red" />
          </div>

          {/* Subtabs */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-1 -mb-px">
              {([
                { key: 'daily' as const, label: '일별 추이', icon: <Calendar className="w-4 h-4" /> },
                { key: 'monthly' as const, label: '월별 비교', icon: <BarChart3 className="w-4 h-4" /> },
                { key: 'compare' as const, label: '광고주 비교', icon: <Users className="w-4 h-4" /> },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSubtab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                    subtab === t.key
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Daily Chart */}
          {subtab === 'daily' && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
              <h3 className="text-sm font-semibold text-gray-700">일별 광고비 · 매출 추이 (만원)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={dailyChart} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} interval={interval} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fill: '#94A3B8', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="매출(만)" fill="#22C55E18" stroke={CHART_COLORS.green} strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="광고비(만)" fill="#4F6AFF10" stroke={CHART_COLORS.blue} strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="구매" stroke={CHART_COLORS.amber} strokeWidth={1} dot={false} yAxisId="r" />
                </ComposedChart>
              </ResponsiveContainer>

              <h3 className="text-sm font-semibold text-gray-700">ROAS 추이</h3>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={dailyChart} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} interval={interval} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}x`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="ROAS" fill="#8B5CF615" stroke={CHART_COLORS.purple} strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Monthly Chart + Table */}
          {subtab === 'monthly' && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
              <h3 className="text-sm font-semibold text-gray-700">월별 광고비 · 매출 (만원)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyChart} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="광고비(만)" fill={CHART_COLORS.blue} radius={[3, 3, 0, 0]} barSize={14} />
                  <Bar dataKey="매출(만)" fill={CHART_COLORS.green} radius={[3, 3, 0, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>

              {/* Monthly Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      {['월', '광고주', '광고비', '매출', '구매', 'CPA', 'AOV', 'ROAS'].map((h) => (
                        <th key={h} className="py-2.5 px-3 text-right text-xs font-semibold text-gray-500 first:text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 font-semibold text-gray-700">{m.year_month}</td>
                        <td className="py-2 px-3 text-right text-gray-500">{m.client_code}</td>
                        <td className="py-2 px-3 text-right text-blue-600 font-medium">{fmt(m.spend, 'won')}</td>
                        <td className="py-2 px-3 text-right text-green-600 font-medium">{fmt(m.revenue, 'won')}</td>
                        <td className="py-2 px-3 text-right">{Number(m.purchases).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-gray-500">₩{Number(m.avg_cpa).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-gray-500">₩{Number(m.avg_aov).toLocaleString()}</td>
                        <td className={`py-2 px-3 text-right font-bold ${
                          m.roas >= 3 ? 'text-green-600' : m.roas >= 2 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {m.roas}x
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Advertiser Comparison */}
          {subtab === 'compare' && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
              <h3 className="text-sm font-semibold text-gray-700">광고주별 성과 비교</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {compare.map((c, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-5 border-l-4" style={{ borderColor: i === 0 ? CHART_COLORS.blue : CHART_COLORS.purple }}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-lg font-bold text-gray-900">{c.client_code}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        c.roas >= 3 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        ROAS {c.roas}x
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { l: '광고비', v: fmt(c.spend, 'won'), cls: 'text-blue-600' },
                        { l: '매출', v: fmt(c.revenue, 'won'), cls: 'text-green-600' },
                        { l: '구매', v: Number(c.purchases).toLocaleString(), cls: 'text-gray-900' },
                        { l: 'CPA', v: `₩${Number(c.cpa).toLocaleString()}`, cls: 'text-red-600' },
                        { l: 'CPC', v: `₩${Number(c.cpc).toLocaleString()}`, cls: 'text-gray-600' },
                        { l: 'CTR', v: `${c.ctr}%`, cls: 'text-gray-600' },
                      ].map((item, j) => (
                        <div key={j}>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase">{item.l}</p>
                          <p className={`text-sm font-bold ${item.cls}`}>{item.v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {compare.length >= 2 && (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={compare.map((c) => ({
                      name: c.client_code,
                      '광고비(만)': Math.round(Number(c.spend) / 1e4),
                      '매출(만)': Math.round(Number(c.revenue) / 1e4),
                    }))}
                    margin={{ top: 5, right: 10, bottom: 5, left: -10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="name" tick={{ fill: '#334155', fontSize: 13, fontWeight: 600 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="광고비(만)" fill={CHART_COLORS.blue} radius={[5, 5, 0, 0]} barSize={44} />
                    <Bar dataKey="매출(만)" fill={CHART_COLORS.green} radius={[5, 5, 0, 0]} barSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Advertiser View ──────────────────────────────────
function AdvertiserView() {
  const [adv, setAdv] = useState('FCMM');
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [k, d, m] = await Promise.all([
      rpc<KpiData>('digo_ad_kpi', { p_client_code: adv, p_date_from: '2025-01-01', p_date_to: '2026-03-10' }),
      rpc<{ data: DailyRow[] }>('digo_ad_daily', { p_client_code: adv, p_date_from: '2025-01-01', p_date_to: '2026-03-10' }),
      rpc<{ data: MonthlyRow[] }>('digo_ad_monthly', { p_client_code: adv, p_year: null }),
    ]);
    setKpi(k);
    setDaily(d?.data || []);
    setMonthly(m?.data || []);
    setLoading(false);
  }, [adv]);

  useEffect(() => { load(); }, [load]);

  const k = kpi?.kpi;
  const recent30 = useMemo(
    () =>
      daily.slice(-30).map((d) => ({
        date: d.stat_date.slice(5),
        '광고비(만)': Math.round(Number(d.cost) / 1e4),
        '매출(만)': Math.round(Number(d.conversion_value) / 1e4),
        ROAS: Number(d.roas),
      })),
    [daily],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <select value={adv} onChange={(e) => setAdv(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="FCMM">FCMM</option>
          <option value="OZEC">오제끄</option>
        </select>
        <span className="text-xs text-gray-400">광고주 전용 리포트</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AdKpiCard title="총 광고비" value={fmt(k?.spend, 'won')} icon={<DollarSign className="w-5 h-5 text-blue-600" />} color="blue" />
            <AdKpiCard title="추정 매출" value={fmt(k?.revenue, 'won')} icon={<TrendingUp className="w-5 h-5 text-green-600" />} color="green" />
            <AdKpiCard title="ROAS" value={fmt(k?.roas, 'roas')} icon={<Target className="w-5 h-5 text-purple-600" />} color="purple" />
            <AdKpiCard title="총 구매" value={fmt(k?.purchases)} icon={<ShoppingCart className="w-5 h-5 text-yellow-600" />} color="amber" />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">최근 30일 추이</h3>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={recent30} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill: '#94A3B8', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}x`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="광고비(만)" fill={CHART_COLORS.blue} radius={[2, 2, 0, 0]} barSize={8} />
                <Bar dataKey="매출(만)" fill={CHART_COLORS.green} radius={[2, 2, 0, 0]} barSize={8} />
                <Line type="monotone" dataKey="ROAS" stroke={CHART_COLORS.purple} strokeWidth={2} dot={false} yAxisId="r" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">월별 성과</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    {['월', '광고비', '매출', '구매', 'CPA', 'ROAS'].map((h) => (
                      <th key={h} className="py-2 px-3 text-right text-xs font-semibold text-gray-500 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-semibold text-gray-700">{m.year_month}</td>
                      <td className="py-2 px-3 text-right text-blue-600 font-medium">{fmt(m.spend, 'won')}</td>
                      <td className="py-2 px-3 text-right text-green-600 font-medium">{fmt(m.revenue, 'won')}</td>
                      <td className="py-2 px-3 text-right">{Number(m.purchases).toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-gray-500">₩{Number(m.avg_cpa).toLocaleString()}</td>
                      <td className={`py-2 px-3 text-right font-bold ${m.roas >= 3 ? 'text-green-600' : m.roas >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {m.roas}x
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Influencer View ──────────────────────────────────
function InfluencerView() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [compare, setCompare] = useState<CompareRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [k, c, m] = await Promise.all([
        rpc<KpiData>('digo_ad_kpi', { p_client_code: null, p_date_from: '2025-01-01', p_date_to: '2026-03-10' }),
        rpc<{ data: CompareRow[] }>('digo_ad_compare', { p_date_from: '2025-01-01', p_date_to: '2026-03-10' }),
        rpc<{ data: MonthlyRow[] }>('digo_ad_monthly', { p_client_code: null, p_year: null }),
      ]);
      setKpi(k);
      setCompare(c?.data || []);
      setMonthly(m?.data || []);
      setLoading(false);
    })();
  }, []);

  const k = kpi?.kpi;
  const pieData = compare.map((c, i) => ({
    name: c.client_code,
    value: Number(c.spend),
    color: [CHART_COLORS.blue, CHART_COLORS.purple][i] || CHART_COLORS.teal,
  }));

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-indigo-50 to-teal-50 rounded-xl p-5 border border-indigo-100">
        <h3 className="text-base font-bold text-gray-800">👋 인플루언서 성과 요약</h3>
        <p className="text-sm text-gray-500 mt-1">현재 2개 광고주(FCMM, 오제끄)의 캠페인에 참여 중입니다.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AdKpiCard title="전체 매출" value={fmt(k?.revenue, 'won')} icon={<TrendingUp className="w-5 h-5 text-green-600" />} color="green" />
            <AdKpiCard title="총 전환수" value={fmt(k?.purchases)} icon={<ShoppingCart className="w-5 h-5 text-yellow-600" />} color="amber" />
            <AdKpiCard title="평균 ROAS" value={fmt(k?.roas, 'roas')} icon={<Target className="w-5 h-5 text-purple-600" />} color="purple" />
            <AdKpiCard title="노출수" value={fmt(k?.impressions)} subtitle={`클릭 ${fmt(k?.clicks)}`} icon={<Eye className="w-5 h-5 text-blue-600" />} color="blue" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">광고주별 지출 비중</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    style={{ fontSize: 11, fontWeight: 600 }}
                  >
                    {pieData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v, 'won')} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">광고주별 핵심 지표</h3>
              {compare.map((c, i) => (
                <div key={i} className={`py-3 ${i < compare.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold" style={{ color: [CHART_COLORS.blue, CHART_COLORS.purple][i] }}>
                      {c.client_code}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      c.roas >= 3 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      ROAS {c.roas}x
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>광고비 <b className="text-gray-800">{fmt(c.spend, 'won')}</b></span>
                    <span>매출 <b className="text-green-600">{fmt(c.revenue, 'won')}</b></span>
                    <span>구매 <b className="text-gray-800">{Number(c.purchases).toLocaleString()}</b></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">월별 전체 매출 추이 (만원)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={monthly.map((m) => ({ month: m.year_month.slice(2), '매출(만)': Math.round(Number(m.revenue) / 1e4) }))}
                margin={{ top: 5, right: 10, bottom: 5, left: -10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="매출(만)" fill={CHART_COLORS.green} radius={[3, 3, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────
type RoleTab = 'admin' | 'advertiser' | 'influencer';

const ROLE_TABS: { key: RoleTab; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'admin', label: '어드민', icon: <BarChart3 className="w-4 h-4" />, color: 'bg-primary-600' },
  { key: 'advertiser', label: '광고주', icon: <TrendingUp className="w-4 h-4" />, color: 'bg-green-600' },
  { key: 'influencer', label: '인플루언서', icon: <Users className="w-4 h-4" />, color: 'bg-purple-600' },
];

export default function App() {
  const [role, setRole] = useState<RoleTab>('admin');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            통계 및 리포트
            
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            광고 성과 데이터 분석 · Meta Ads
          </p>
        </div>

        {/* Role Tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
          {ROLE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setRole(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition ${
                role === t.key ? `${t.color} text-white shadow-sm` : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Views */}
      {role === 'admin' && <AdminView />}
      {role === 'advertiser' && <AdvertiserView />}
      {role === 'influencer' && <InfluencerView />}

      {/* Footer */}
      <p className="text-center text-[10px] text-gray-300">
        Digo × BizSpring mDP · de_ad_spend_daily · Supabase RPC
      </p>
    </div>
  );
}
