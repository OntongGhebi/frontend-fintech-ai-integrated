import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "./ReportAnalytics.css";

type AnalyticsItem = {
  categoryId?: string | null;
  categoryName?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  totalAmount?: number | string | null;
  transactionCount?: number | null;
  percentage?: number | null;
};

type MonthlyItem = {
  month?: string;
  income?: number | string | null;
  expense?: number | string | null;
  netCashFlow?: number | string | null;
  transactionCount?: number | null;
  savingsRate?: number | string | null;
};

type AnalyticsSource = {
  monthlyFinancialSummary?: {
    months?: MonthlyItem[];
  } | null;
  categoryAnalytics?: {
    categories?: AnalyticsItem[];
  } | null;
  accountAnalytics?: {
    accounts?: AnalyticsItem[];
  } | null;
};

type ChartRow = {
  name: string;
  income?: number;
  expense?: number;
  amount?: number;
  percentage?: number;
  transactions?: number;
};

type ReportAnalyticsProps = {
  report: AnalyticsSource;
};

const PIE_COLORS = [
  "#6366f1",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
  "#0ea5e9",
  "#8b5cf6",
];

const formatIDR = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const formatMonth = (value: string | undefined): string => {
  if (!value) {
    return "-";
  }

  // Mendukung format bulan seperti 2026-10 dan tanggal ISO.
  const match = value.match(/^(\d{4})-(\d{2})/);

  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);

    return new Intl.DateTimeFormat("id-ID", {
      month: "short",
      year: "2-digit",
    }).format(date);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "2-digit",
  }).format(date);
};

const currencyTick = (value: number): string => {
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return `Rp${(value / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} M`;
  }

  if (absValue >= 1_000_000) {
    return `Rp${(value / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }

  if (absValue >= 1_000) {
    return `Rp${(value / 1_000).toLocaleString("id-ID", {
      maximumFractionDigits: 0,
    })} rb`;
  }

  return `Rp${value.toLocaleString("id-ID")}`;
};

function CurrencyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="report-chart-tooltip">
      {label && <p className="report-chart-tooltip__label">{label}</p>}

      {payload.map((item, index) => (
        <p key={`${item.name ?? "series"}-${index}`}>
          <span>{item.name ?? "Nominal"}</span>
          <strong>{formatIDR(toNumber(item.value))}</strong>
        </p>
      ))}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="report-chart-empty">
      <p>{message}</p>
    </div>
  );
}

function AnalyticsBarChart({
  title,
  description,
  data,
  nameKey,
}: {
  title: string;
  description: string;
  data: ChartRow[];
  nameKey: "category" | "account";
}) {
  const labelKey = nameKey === "category" ? "kategori" : "akun";

  return (
    <section className="report-analytics-card">
      <div className="report-analytics-card__header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyChart message={`Belum ada data ${labelKey} untuk periode ini.`} />
      ) : (
        <div className="report-chart report-chart--horizontal">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
            >
              <CartesianGrid
                stroke="var(--report-chart-grid, #e5e7eb)"
                strokeDasharray="3 3"
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={currencyTick}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={105}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CurrencyTooltip />} />
              <Bar
                dataKey="amount"
                name="Total"
                fill="var(--report-chart-primary, #6366f1)"
                radius={[0, 5, 5, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export function ReportAnalytics({ report }: ReportAnalyticsProps) {
  const monthlyData: ChartRow[] = (
    report.monthlyFinancialSummary?.months ?? []
  ).map((item) => ({
    name: formatMonth(item.month),
    income: toNumber(item.income),
    expense: toNumber(item.expense),
    amount: toNumber(item.netCashFlow),
    transactions:
      item.transactionCount == null
        ? undefined
        : toNumber(item.transactionCount),
  }));

  const categoryData: ChartRow[] = (report.categoryAnalytics?.categories ?? [])
    .map((item) => ({
      name: item.categoryName?.trim() || "Tanpa nama",
      amount: toNumber(item.totalAmount),
      percentage:
        item.percentage == null ? undefined : toNumber(item.percentage),
      transactions:
        item.transactionCount == null
          ? undefined
          : toNumber(item.transactionCount),
    }))
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));

  const accountData: ChartRow[] = (report.accountAnalytics?.accounts ?? [])
    .map((item) => ({
      name: item.accountName?.trim() || "Tanpa nama",
      amount: toNumber(item.totalAmount),
      percentage:
        item.percentage == null ? undefined : toNumber(item.percentage),
      transactions:
        item.transactionCount == null
          ? undefined
          : toNumber(item.transactionCount),
    }))
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));

  const categoryPieData = categoryData.filter((item) => (item.amount ?? 0) > 0);

  return (
    <div className="report-analytics">
      <section className="report-analytics-section">
        <div className="report-analytics-section__heading">
          <div>
            <h2>Tren keuangan</h2>
            <p>Perbandingan pendapatan dan pengeluaran per bulan.</p>
          </div>
        </div>

        <div className="report-analytics-card">
          {monthlyData.length === 0 ? (
            <EmptyChart message="Belum ada data bulanan untuk periode laporan ini." />
          ) : (
            <div className="report-chart report-chart--monthly">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyData}
                  margin={{ top: 12, right: 18, left: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    stroke="var(--report-chart-grid, #e5e7eb)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={currencyTick}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={78}
                  />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Pendapatan"
                    stroke="var(--report-chart-income, #16a34a)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    name="Pengeluaran"
                    stroke="var(--report-chart-expense, #ef4444)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section className="report-analytics-section">
        <div className="report-analytics-section__heading">
          <div>
            <h2>Analisis pengeluaran berdasarkan kategori</h2>
            <p>Kategori dengan nominal terbesar ditampilkan lebih dahulu.</p>
          </div>
        </div>

        <div className="report-analytics-grid">
          <AnalyticsBarChart
            title="Nominal per kategori"
            description="Perbandingan total nominal setiap kategori."
            data={categoryData}
            nameKey="category"
          />

          <section className="report-analytics-card">
            <div className="report-analytics-card__header">
              <div>
                <h3>Proporsi kategori</h3>
                <p>Distribusi nominal antar kategori.</p>
              </div>
            </div>

            {categoryPieData.length === 0 ? (
              <EmptyChart message="Belum ada nominal kategori untuk ditampilkan." />
            ) : (
              <>
                <div className="report-chart report-chart--pie">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryPieData}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius="72%"
                        innerRadius="42%"
                        paddingAngle={2}
                      >
                        {categoryPieData.map((item, index) => (
                          <Cell
                            key={`${item.name}-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CurrencyTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="report-category-legend">
                  {categoryPieData.map((item, index) => (
                    <div
                      className="report-category-legend__item"
                      key={`${item.name}-${index}`}
                    >
                      <span
                        className={`report-category-legend__dot report-category-legend__dot--${index % PIE_COLORS.length}`}
                        aria-hidden="true"
                      />
                      <span className="report-category-legend__name">
                        {item.name}
                      </span>
                      <strong>{formatIDR(item.amount ?? 0)}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </section>

      <section className="report-analytics-section">
        <div className="report-analytics-section__heading">
          <div>
            <h2>Analisis akun</h2>
            <p>Perbandingan nominal transaksi pada setiap akun.</p>
          </div>
        </div>

        <AnalyticsBarChart
          title="Nominal per akun"
          description="Akun dengan nominal terbesar ditampilkan lebih dahulu."
          data={accountData}
          nameKey="account"
        />
      </section>
    </div>
  );
}
