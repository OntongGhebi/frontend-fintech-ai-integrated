import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ApiRequestError, apiClient } from "../lib/api-client";
import {
  parseCategoryAnalytics,
  parseDashboardOverview,
  parseCashFlow,
} from "../lib/dashboard/dashboard-contract";
import type {
  DashboardCategoryAnalyticsResponse,
  DashboardOverviewResponse,
  DashboardCashFlowResponse,
} from "../types/dashboard";
import { RecurringPerformanceSection } from "./dashboard/RecurringPerformanceSection";
import { CashFlowAnalyticsSection } from "./dashboard/CashFlowAnalyticsSection";
import "./DashboardPage.css";

type DashboardOverview = DashboardOverviewResponse;
type CategoryAnalytics = DashboardCategoryAnalyticsResponse;

interface Comparison {
  current: number;
  previous: number;
  difference: number;
  percentage: number | null;
}

type DashboardTransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

interface RecentTransaction {
  id: string;
  type: DashboardTransactionType;
  amount: string;
  currency: string;
  description: string | null;
  transactionDate: string;
  status: string;
}

interface RecentTransactionResponse {
  data: RecentTransaction[];
}

function toAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value: string | number, currency = "IDR"): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCurrency(
  value: string | number,
  currency = "IDR",
): string {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";

  if (currency === "IDR" && absolute >= 1_000_000_000) {
    return `${sign}Rp ${(absolute / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} M`;
  }

  if (currency === "IDR" && absolute >= 1_000_000) {
    return `${sign}Rp ${(absolute / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }

  if (currency === "IDR" && absolute >= 10_000) {
    return `${sign}Rp ${(absolute / 1_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} rb`;
  }

  return formatCurrency(amount, currency);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("id-ID", {
    maximumFractionDigits: 1,
  })}%`;
}

function formatDayLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? String(Number(match[3])) : value;
}

function formatWeekLabel(
  value: string,
  range: { startDate: string; endDate: string },
): string {
  const weekStart = new Date(`${value}T00:00:00.000Z`);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const monthStart = new Date(`${range.startDate}T00:00:00.000Z`);
  const monthEnd = new Date(`${range.endDate}T00:00:00.000Z`);
  const visibleStart = weekStart < monthStart ? monthStart : weekStart;
  const visibleEnd = weekEnd > monthEnd ? monthEnd : weekEnd;
  const startDay = visibleStart.getUTCDate();
  const endDay = visibleEnd.getUTCDate();
  return startDay === endDay ? `${startDay}` : `${startDay}–${endDay}`;
}

function formatMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);

  if (!match) {
    return month;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);

  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getMonthRange(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const toInputDate = (date: Date) => {
    const localYear = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${localYear}-${month}-${day}`;
  };

  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  };
}

function getUtcDateTimeRange(range: { startDate: string; endDate: string }) {
  return {
    startDate: `${range.startDate}T00:00:00.000Z`,
    endDate: `${range.endDate}T23:59:59.999Z`,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Backend tidak dapat dijangkau. Pastikan server API aktif dan URL API sudah benar.";
    }

    return error.message || "Dashboard gagal dimuat.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan saat memuat data dashboard.";
}

function getPeriodComparison(
  currentValue: string | number | undefined,
  previousValue: string | number | undefined,
): Comparison | null {
  if (currentValue === undefined || previousValue === undefined) return null;

  const current = toAmount(currentValue);
  const previous = toAmount(previousValue);
  const difference = current - previous;
  const percentage =
    previous > 0 ? (difference / previous) * 100 : current === 0 ? 0 : null;

  return { current, previous, difference, percentage };
}

function getPreviousPeriodRange(
  range: { startDate: string; endDate: string },
  mode: "month" | "custom",
): { startDate: string; endDate: string } {
  if (mode === "month") {
    const [year, month] = range.startDate.split("-").map(Number);
    const previousMonth = new Date(Date.UTC(year, month - 2, 1));
    const previousEnd = new Date(Date.UTC(year, month - 1, 0));
    return {
      startDate: previousMonth.toISOString().slice(0, 10),
      endDate: previousEnd.toISOString().slice(0, 10),
    };
  }

  const start = new Date(`${range.startDate}T00:00:00.000Z`);
  const end = new Date(`${range.endDate}T00:00:00.000Z`);
  const durationDays =
    Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(start.getTime() - 86_400_000);
  const previousStart = new Date(
    previousEnd.getTime() - (durationDays - 1) * 86_400_000,
  );

  return {
    startDate: previousStart.toISOString().slice(0, 10),
    endDate: previousEnd.toISOString().slice(0, 10),
  };
}

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [previousOverview, setPreviousOverview] =
    useState<DashboardOverview | null>(null);
  const [incomeAnalytics, setIncomeAnalytics] =
    useState<CategoryAnalytics | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<
    RecentTransaction[]
  >([]);
  const [recentTransactionsLoading, setRecentTransactionsLoading] =
    useState(true);
  const [recentTransactionsError, setRecentTransactionsError] = useState<
    string | null
  >(null);
  const [budgetLoaded, setBudgetLoaded] = useState(false);
  const [monthlyBudgetAllocations, setMonthlyBudgetAllocations] = useState<
    Record<string, number>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<"6" | "12">("12");
  const [moneyFlowGranularity, setMoneyFlowGranularity] = useState<
    "DAY" | "WEEK"
  >("DAY");
  const [granularCashFlow, setGranularCashFlow] =
    useState<DashboardCashFlowResponse | null>(null);
  const [granularCashFlowLoading, setGranularCashFlowLoading] = useState(false);
  const [granularCashFlowError, setGranularCashFlowError] = useState<
    string | null
  >(null);
  const now = new Date();
  const [periodMode, setPeriodMode] = useState<"month" | "custom">("month");
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth()));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const initialMonthRange = getMonthRange(now.getFullYear(), now.getMonth());
  const [customStartDate, setCustomStartDate] = useState(
    initialMonthRange.startDate,
  );
  const [customEndDate, setCustomEndDate] = useState(initialMonthRange.endDate);
  const [appliedCustomRange, setAppliedCustomRange] =
    useState(initialMonthRange);
  const [periodError, setPeriodError] = useState<string | null>(null);

  const activeRange =
    periodMode === "month"
      ? getMonthRange(Number(selectedYear), Number(selectedMonth))
      : appliedCustomRange;
  const queryString = `?startDate=${encodeURIComponent(activeRange.startDate)}&endDate=${encodeURIComponent(activeRange.endDate)}`;
  const previousRange = getPreviousPeriodRange(activeRange, periodMode);
  const previousQueryString = `?startDate=${encodeURIComponent(previousRange.startDate)}&endDate=${encodeURIComponent(previousRange.endDate)}`;

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      setIsLoading(true);
      setErrorMessage(null);
      setBudgetLoaded(false);

      const [overviewResult, incomeResult, previousOverviewResult] =
        await Promise.allSettled([
          apiClient.get<unknown>(`/dashboard/overview${queryString}`),
          apiClient.get<unknown>(
            `/dashboard/categories?type=INCOME&startDate=${encodeURIComponent(activeRange.startDate)}&endDate=${encodeURIComponent(activeRange.endDate)}`,
          ),
          apiClient.get<unknown>(`/dashboard/overview${previousQueryString}`),
        ]);

      if (cancelled) return;

      let overviewLoaded = false;
      if (overviewResult.status === "fulfilled") {
        try {
          setOverview(parseDashboardOverview(overviewResult.value));
          overviewLoaded = true;
        } catch (error) {
          setOverview(null);
          setErrorMessage(getErrorMessage(error));
        }
      } else {
        setOverview(null);
        setErrorMessage(getErrorMessage(overviewResult.reason));
      }

      if (previousOverviewResult.status === "fulfilled") {
        try {
          setPreviousOverview(
            parseDashboardOverview(previousOverviewResult.value),
          );
        } catch {
          setPreviousOverview(null);
        }
      } else {
        setPreviousOverview(null);
      }

      if (incomeResult.status === "fulfilled") {
        try {
          setIncomeAnalytics(parseCategoryAnalytics(incomeResult.value));
        } catch {
          setIncomeAnalytics(null);
        }
      } else {
        setIncomeAnalytics(null);
      }

      setBudgetLoaded(overviewLoaded);
      setIsLoading(false);
    }

    void fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, [
    reloadKey,
    queryString,
    previousQueryString,
    activeRange.startDate,
    activeRange.endDate,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function fetchGranularCashFlow() {
      if (periodMode !== "month") {
        setGranularCashFlow(null);
        setGranularCashFlowError(null);
        setGranularCashFlowLoading(false);
        return;
      }

      setGranularCashFlowLoading(true);
      setGranularCashFlowError(null);

      const dateRange = getUtcDateTimeRange(activeRange);

      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        period: moneyFlowGranularity,
      });

      try {
        const response = await apiClient.get<unknown>(
          `/dashboard/cash-flow?${params.toString()}`,
        );
        const parsed = parseCashFlow(response);
        if (!cancelled) setGranularCashFlow(parsed);
      } catch (error) {
        if (!cancelled) {
          setGranularCashFlow(null);
          setGranularCashFlowError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) setGranularCashFlowLoading(false);
      }
    }

    void fetchGranularCashFlow();
    return () => {
      cancelled = true;
    };
  }, [
    periodMode,
    activeRange.startDate,
    activeRange.endDate,
    moneyFlowGranularity,
    reloadKey,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecentTransactions() {
      setRecentTransactionsLoading(true);
      setRecentTransactionsError(null);

      try {
        const response = await apiClient.get<RecentTransactionResponse>(
          "transactions?page=1&limit=5&status=ACTIVE",
        );

        if (!cancelled) {
          setRecentTransactions(
            Array.isArray(response.data) ? response.data : [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          setRecentTransactions([]);
          setRecentTransactionsError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) setRecentTransactionsLoading(false);
      }
    }

    void fetchRecentTransactions();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const summary = overview?.summary;
  const monthlySummary = overview?.monthlyFinancialSummary;
  const currency = overview?.currency ?? "IDR";
  const allMonths = monthlySummary?.months ?? [];

  const months = useMemo(
    () => allMonths.slice(-Number(selectedPeriod)),
    [allMonths, selectedPeriod],
  );

  const topIncomeCategories = useMemo(
    () =>
      [...(incomeAnalytics?.categories ?? [])]
        .filter((item) => toAmount(item.totalAmount) > 0)
        .sort(
          (first, second) =>
            toAmount(second.totalAmount) - toAmount(first.totalAmount),
        )
        .slice(0, 3),
    [incomeAnalytics?.categories],
  );

  const incomeComparison = useMemo(
    () =>
      getPeriodComparison(
        summary?.totalIncome,
        previousOverview?.summary.totalIncome,
      ),
    [summary?.totalIncome, previousOverview?.summary.totalIncome],
  );

  const expenseComparison = useMemo(
    () =>
      getPeriodComparison(
        summary?.totalExpense,
        previousOverview?.summary.totalExpense,
      ),
    [summary?.totalExpense, previousOverview?.summary.totalExpense],
  );

  const budgetTotals = useMemo(() => {
    const performance = overview?.budgetPerformance;
    const totalBudget = toAmount(performance?.totalBudgetAmount);
    const totalActual = toAmount(performance?.totalActualAmount);
    const remaining = toAmount(performance?.totalRemainingAmount);

    return {
      totalBudget,
      totalActual,
      remaining,
      remainingPercentage:
        totalBudget > 0
          ? Math.max(0, Math.min(100, (remaining / totalBudget) * 100))
          : null,
      usagePercentage:
        totalBudget > 0 ? (totalActual / totalBudget) * 100 : null,
    };
  }, [overview?.budgetPerformance]);

  const previousBudgetUsage = useMemo(() => {
    const performance = previousOverview?.budgetPerformance;
    const totalBudget = toAmount(performance?.totalBudgetAmount);
    const totalActual = toAmount(performance?.totalActualAmount);
    return totalBudget > 0 ? (totalActual / totalBudget) * 100 : null;
  }, [previousOverview?.budgetPerformance]);

  const budgetUsageChange =
    budgetTotals.usagePercentage !== null && previousBudgetUsage !== null
      ? budgetTotals.usagePercentage - previousBudgetUsage
      : null;

  const topBudgetAllocations = useMemo(
    () =>
      [...(overview?.budgetPerformance?.budgets ?? [])]
        .filter((budget) => toAmount(budget.budgetAmount) > 0)
        .sort(
          (first, second) =>
            toAmount(second.usagePercentage) - toAmount(first.usagePercentage),
        )
        .slice(0, 3),
    [overview?.budgetPerformance?.budgets],
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchMonthlyBudgetAllocations() {
      if (months.length === 0) {
        setMonthlyBudgetAllocations({});
        return;
      }

      const results = await Promise.all(
        months.map(async (month) => {
          const [year, monthNumber] = month.month.split("-").map(Number);
          if (!year || !monthNumber) return [month.month, 0] as const;

          const range = getMonthRange(year, monthNumber - 1);
          const isActiveMonth =
            periodMode === "month" &&
            Number(selectedYear) === year &&
            Number(selectedMonth) + 1 === monthNumber;

          const overviewMatchesMonth =
            overview?.monthlyFinancialSummary.startDate === range.startDate &&
            overview?.monthlyFinancialSummary.endDate === range.endDate;

          if (isActiveMonth && overview && overviewMatchesMonth) {
            return [
              month.month,
              toAmount(overview.budgetPerformance?.totalBudgetAmount),
            ] as const;
          }

          try {
            const response = await apiClient.get<unknown>(
              `/dashboard/overview?startDate=${encodeURIComponent(range.startDate)}&endDate=${encodeURIComponent(range.endDate)}`,
            );
            const monthlyOverview = parseDashboardOverview(response);
            return [
              month.month,
              toAmount(monthlyOverview.budgetPerformance?.totalBudgetAmount),
            ] as const;
          } catch {
            return [month.month, 0] as const;
          }
        }),
      );

      if (!cancelled) {
        setMonthlyBudgetAllocations(Object.fromEntries(results));
      }
    }

    void fetchMonthlyBudgetAllocations();
    return () => {
      cancelled = true;
    };
  }, [months, overview, periodMode, selectedMonth, selectedYear, reloadKey]);

  const isMonthlyRange = periodMode === "month";
  const activeMonthlySpace = Math.max(
    0,
    toAmount(overview?.budgetPerformance?.totalBudgetAmount),
  );

  const moneyFlowItems =
    isMonthlyRange && granularCashFlow
      ? granularCashFlow.cashFlows.map((item) => ({
          key: item.period,
          label:
            moneyFlowGranularity === "DAY"
              ? formatDayLabel(item.period)
              : formatWeekLabel(item.period, activeRange),
          title:
            moneyFlowGranularity === "DAY"
              ? new Intl.DateTimeFormat("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(new Date(`${item.period}T00:00:00.000Z`))
              : `Minggu ${formatWeekLabel(item.period, activeRange)} ${formatMonth(`${selectedYear}-${String(Number(selectedMonth) + 1).padStart(2, "0")}`)}`,
          income: toAmount(item.income),
          expense: toAmount(item.expense),
          // Monthly allocation is shown as one reference line, never split into daily/weekly values.
          space: 0,
        }))
      : months.map((month) => ({
          key: month.month,
          label: formatMonth(month.month),
          title: formatMonth(month.month),
          income: toAmount(month.income),
          expense: toAmount(month.expense),
          space: Math.max(0, toAmount(monthlyBudgetAllocations[month.month])),
        }));

  const moneyFlowMaximum = Math.max(
    1,
    ...moneyFlowItems.flatMap((item) => [
      item.income,
      item.expense,
      item.space,
    ]),
    ...(isMonthlyRange ? [activeMonthlySpace] : []),
  );
  const moneyFlowScaleMaximum = moneyFlowMaximum / 0.88;
  const hasMoneyFlowData =
    moneyFlowItems.some(
      (item) => item.income > 0 || item.expense > 0 || item.space > 0,
    ) ||
    (isMonthlyRange && activeMonthlySpace > 0);

  const income = toAmount(summary?.totalIncome);
  const cashFlow = toAmount(summary?.netCashFlow);
  const savingsRate =
    income > 0 ? Math.max(0, Math.min(100, (cashFlow / income) * 100)) : 0;

  return (
    <main className="dashboard-page">
      {errorMessage && (
        <div className="dashboard-error" role="alert">
          <div className="dashboard-error-symbol" aria-hidden="true">
            !
          </div>
          <div className="dashboard-error-copy">
            <strong>Data dashboard belum tersedia</strong>
            <p>{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            disabled={isLoading}
          >
            Coba lagi
          </button>
        </div>
      )}

      <section
        className="dashboard-summary-layout dashboard-reference-summary"
        aria-label="Ringkasan keuangan"
      >
        <article className="dashboard-balance-card dashboard-reference-card">
          <div className="dashboard-reference-card-top">
            <span>My Balance</span>
            <div
              className="dashboard-inline-period"
              aria-label="Periode dashboard"
            >
              <label className="dashboard-inline-period-mode">
                <span className="sr-only">Jenis periode</span>
                <select
                  aria-label="Jenis periode analitik"
                  value={periodMode}
                  onChange={(event) => {
                    setPeriodMode(event.target.value as "month" | "custom");
                    setPeriodError(null);
                  }}
                >
                  <option value="month">Bulanan</option>
                  <option value="custom">Kustom</option>
                </select>
              </label>
              {periodMode === "month" ? (
                <>
                  <label>
                    <span className="sr-only">Pilih bulan</span>
                    <select
                      aria-label="Pilih bulan"
                      value={selectedMonth}
                      onChange={(event) => setSelectedMonth(event.target.value)}
                    >
                      {Array.from({ length: 12 }, (_, index) => (
                        <option key={index} value={String(index)}>
                          {new Intl.DateTimeFormat("id-ID", {
                            month: "short",
                          }).format(new Date(2026, index, 1))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Pilih tahun</span>
                    <select
                      aria-label="Pilih tahun"
                      value={selectedYear}
                      onChange={(event) => setSelectedYear(event.target.value)}
                    >
                      {Array.from(
                        { length: 8 },
                        (_, index) => now.getFullYear() - 5 + index,
                      ).map((year) => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    <span className="sr-only">Tanggal mulai</span>
                    <input
                      aria-label="Tanggal mulai"
                      type="date"
                      value={customStartDate}
                      max={customEndDate || undefined}
                      onChange={(event) =>
                        setCustomStartDate(event.target.value)
                      }
                    />
                  </label>
                  <span
                    className="dashboard-inline-period-separator"
                    aria-hidden="true"
                  >
                    –
                  </span>
                  <label>
                    <span className="sr-only">Tanggal akhir</span>
                    <input
                      aria-label="Tanggal akhir"
                      type="date"
                      value={customEndDate}
                      min={customStartDate || undefined}
                      onChange={(event) => setCustomEndDate(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !customStartDate ||
                        !customEndDate ||
                        customStartDate > customEndDate
                      ) {
                        setPeriodError(
                          "Tanggal akhir harus sama dengan atau setelah tanggal mulai.",
                        );
                        return;
                      }
                      setAppliedCustomRange({
                        startDate: customStartDate,
                        endDate: customEndDate,
                      });
                      setPeriodError(null);
                    }}
                  >
                    Terapkan
                  </button>
                </>
              )}
            </div>
          </div>
          {periodError && (
            <p className="dashboard-period-error" role="alert">
              {periodError}
            </p>
          )}

          <div className="dashboard-reference-balance-content">
            <span className="dashboard-reference-muted">Total balance</span>
            <strong
              className="dashboard-reference-balance-value"
              aria-busy={isLoading && !overview}
            >
              {isLoading && !overview
                ? "Memuat…"
                : overview
                  ? formatCurrency(overview.totalCurrentBalance, currency)
                  : "—"}
            </strong>
            <div className="dashboard-reference-mini-stat">
              <span
                className="dashboard-reference-mini-icon"
                aria-hidden="true"
              >
                ↗
              </span>
              <span>Total income</span>
              <strong>
                {summary
                  ? formatCompactCurrency(summary.totalIncome, currency)
                  : "—"}
              </strong>
            </div>
            <div className="dashboard-reference-mini-stat">
              <span
                className="dashboard-reference-mini-icon"
                aria-hidden="true"
              >
                ↘
              </span>
              <span>Total expense</span>
              <strong>
                {summary
                  ? formatCompactCurrency(summary.totalExpense, currency)
                  : "—"}
              </strong>
            </div>
          </div>
        </article>

        <article className="dashboard-stat-card dashboard-stat-card--lime dashboard-reference-card dashboard-reference-income-card">
          <div className="dashboard-reference-card-top">
            <span>My Income</span>
            <span className="dashboard-reference-card-date">
              {new Intl.DateTimeFormat("id-ID", {
                month: "long",
                year: "numeric",
              }).format(
                new Date(Number(selectedYear), Number(selectedMonth), 1),
              )}
            </span>
          </div>

          <div className="dashboard-reference-income-content">
            <div>
              <span className="dashboard-reference-muted">Total income</span>
              <strong className="dashboard-reference-income-value">
                {summary ? formatCurrency(summary.totalIncome, currency) : "—"}
              </strong>
            </div>
            <div
              className="dashboard-reference-mini-bars"
              aria-label="Tren pemasukan bulanan"
            >
              {months.map((month) => {
                const amount = Math.max(0, toAmount(month.income));
                const peak = Math.max(
                  1,
                  ...months.map((item) => toAmount(item.income)),
                );
                return (
                  <i
                    key={month.month}
                    style={{ height: `${Math.max(8, (amount / peak) * 100)}%` }}
                  />
                );
              })}
            </div>
          </div>

          <div className="dashboard-reference-income-stats">
            <div className="dashboard-reference-mini-stat">
              <span
                className="dashboard-reference-mini-icon"
                aria-hidden="true"
              >
                ↗
              </span>
              <span>Change</span>
              <strong
                className={
                  incomeComparison && incomeComparison.difference < 0
                    ? "is-negative"
                    : ""
                }
              >
                {incomeComparison?.percentage === null || !incomeComparison
                  ? "—"
                  : `${incomeComparison.difference > 0 ? "+" : ""}${formatPercent(incomeComparison.percentage)}`}
              </strong>
            </div>
            <div className="dashboard-reference-mini-stat">
              <span
                className="dashboard-reference-mini-icon"
                aria-hidden="true"
              >
                ◈
              </span>
              <span>Categories</span>
              <strong>{incomeAnalytics?.categories?.length ?? 0}</strong>
            </div>
          </div>

          <div className="dashboard-reference-income-sources">
            {topIncomeCategories.length > 0 ? (
              topIncomeCategories.map((category) => (
                <div key={category.categoryId}>
                  <span title={category.categoryName}>
                    {category.categoryName}
                  </span>
                  <strong>
                    {formatCompactCurrency(category.totalAmount, currency)}
                  </strong>
                </div>
              ))
            ) : (
              <p>
                {isLoading
                  ? "Memuat kategori…"
                  : "Belum ada kategori pemasukan"}
              </p>
            )}
          </div>
        </article>

        <article className="dashboard-stat-card dashboard-stat-card--coral dashboard-reference-card dashboard-reference-expense-card">
          <strong className="dashboard-reference-expense-value">
            {summary ? formatCurrency(summary.totalExpense, currency) : "—"}
          </strong>
          <span className="dashboard-reference-muted">Total expense</span>

          <div className="dashboard-reference-expense-stats">
            <div className="dashboard-reference-mini-stat">
              <span
                className="dashboard-reference-mini-icon"
                aria-hidden="true"
              >
                ↗
              </span>
              <span>Change</span>
              <strong
                className={
                  expenseComparison && expenseComparison.difference < 0
                    ? "is-negative"
                    : ""
                }
              >
                {expenseComparison?.percentage === null || !expenseComparison
                  ? "—"
                  : `${expenseComparison.difference > 0 ? "+" : ""}${formatPercent(expenseComparison.percentage)}`}
              </strong>
            </div>
            <div className="dashboard-reference-mini-stat">
              <span
                className="dashboard-reference-mini-icon"
                aria-hidden="true"
              >
                ◈
              </span>
              <span>Budget</span>
              <strong>
                {budgetTotals.totalBudget > 0
                  ? formatCompactCurrency(budgetTotals.totalBudget, currency)
                  : "—"}
              </strong>
            </div>
          </div>

          <div className="dashboard-reference-meter-labels">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
          <div className="dashboard-reference-expense-meter">
            {Array.from({ length: 24 }, (_, index) => {
              const percentage = Math.max(
                0,
                Math.min(100, budgetTotals.usagePercentage ?? 0),
              );
              return (
                <i
                  key={index}
                  className={
                    index < Math.ceil(percentage / (100 / 24)) ? "filled" : ""
                  }
                />
              );
            })}
          </div>
          <div className="dashboard-reference-expense-footer">
            <span>
              {new Intl.DateTimeFormat("id-ID", {
                month: "long",
                year: "numeric",
              }).format(
                new Date(Number(selectedYear), Number(selectedMonth), 1),
              )}
            </span>
            <span>
              {budgetTotals.totalBudget > 0
                ? `Budget usage ${formatPercent(Math.max(0, budgetTotals.usagePercentage ?? 0))}`
                : "Set a monthly budget"}
            </span>
          </div>
        </article>
      </section>

      <section className="dashboard-primary-grid">
        <article
          className="dashboard-panel dashboard-money-flow"
          aria-labelledby="dashboard-money-flow-title"
        >
          <div className="dashboard-panel-heading dashboard-panel-heading--money-flow">
            <div className="dashboard-money-flow-title">
              <h3 id="dashboard-money-flow-title">Money Flow</h3>
            </div>

            <div className="dashboard-money-flow-header-actions">
              <div
                className="dashboard-chart-legend dashboard-chart-legend--inline"
                aria-label="Keterangan grafik"
              >
                <span>
                  <i
                    className="dashboard-legend-dot dashboard-legend-dot--income"
                    aria-hidden="true"
                  />
                  Income
                </span>

                <span>
                  <i
                    className="dashboard-legend-dot dashboard-legend-dot--expense"
                    aria-hidden="true"
                  />
                  Expense
                </span>

                <span>
                  <i
                    className="dashboard-legend-dot dashboard-legend-dot--space"
                    aria-hidden="true"
                  />
                  Space
                </span>
              </div>

              {periodMode === "month" ? (
                <label className="dashboard-period-select dashboard-granularity-select">
                  <span className="sr-only">
                    Granularitas grafik Money Flow
                  </span>
                  <select
                    aria-label="Granularitas grafik Money Flow"
                    value={moneyFlowGranularity}
                    onChange={(event) =>
                      setMoneyFlowGranularity(
                        event.target.value as "DAY" | "WEEK",
                      )
                    }
                  >
                    <option value="DAY">Daily</option>
                    <option value="WEEK">Weekly</option>
                  </select>
                </label>
              ) : (
                <label className="dashboard-period-select">
                  <span className="sr-only">Rentang grafik</span>
                  <select
                    value={selectedPeriod}
                    onChange={(event) =>
                      setSelectedPeriod(event.target.value as "6" | "12")
                    }
                  >
                    <option value="6">6 bulan</option>
                    <option value="12">12 bulan</option>
                  </select>
                </label>
              )}
            </div>
          </div>

          {(
            isMonthlyRange ? granularCashFlowLoading : isLoading && !overview
          ) ? (
            <div className="dashboard-chart-loading" role="status">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : (
              isMonthlyRange ? granularCashFlowError : !overview && errorMessage
            ) ? (
            <div className="dashboard-empty-state" role="status">
              <strong>Grafik belum tersedia</strong>
              <p>
                {isMonthlyRange
                  ? granularCashFlowError
                  : (errorMessage ?? "Data grafik belum berhasil dimuat.")}
              </p>
            </div>
          ) : !hasMoneyFlowData ? (
            <div className="dashboard-empty-state">
              <span className="dashboard-empty-state-icon" aria-hidden="true">
                ↗
              </span>
              <strong>Belum ada aktivitas keuangan</strong>
              <p>
                Grafik akan muncul setelah transaksi atau alokasi anggaran
                tersedia pada periode yang dipilih.
              </p>
            </div>
          ) : (
            <div className="dashboard-chart">
              <div className="dashboard-chart-axis" aria-hidden="true">
                <span>
                  {formatCompactCurrency(moneyFlowScaleMaximum, currency)}
                </span>
                <span>
                  {formatCompactCurrency(moneyFlowScaleMaximum / 2, currency)}
                </span>
                <span>{formatCompactCurrency(0, currency)}</span>
              </div>

              <div
                className="dashboard-chart-plot"
                role="img"
                aria-label={
                  isMonthlyRange
                    ? `Grafik pemasukan dan pengeluaran secara ${moneyFlowGranularity === "DAY" ? "harian" : "mingguan"}, dengan total alokasi anggaran bulanan ${formatCurrency(activeMonthlySpace, currency)} sebagai referensi.`
                    : `Grafik perbandingan pemasukan, pengeluaran, dan total alokasi anggaran selama ${moneyFlowItems.length} bulan.`
                }
              >
                <div className="dashboard-chart-gridline dashboard-chart-gridline--one" />
                <div className="dashboard-chart-gridline dashboard-chart-gridline--two" />
                <div className="dashboard-chart-gridline dashboard-chart-gridline--three" />
                {isMonthlyRange && activeMonthlySpace > 0 && (
                  <div
                    className="dashboard-chart-space-reference"
                    style={{
                      bottom: `calc(17px + ${(activeMonthlySpace / moneyFlowScaleMaximum) * 100}%)`,
                    }}
                    aria-hidden="true"
                  />
                )}

                <div
                  className="dashboard-chart-columns"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(moneyFlowItems.length, 1)}, minmax(0, 1fr))`,
                  }}
                >
                  {moneyFlowItems.map((item) => {
                    const chartSeries = [
                      {
                        key: "income",
                        value: item.income,
                        className: "dashboard-chart-bar--income",
                      },
                      {
                        key: "expense",
                        value: item.expense,
                        className: "dashboard-chart-bar--expense",
                      },
                    ].sort((first, second) => second.value - first.value);

                    return (
                      <div className="dashboard-chart-column" key={item.key}>
                        <div
                          className="dashboard-chart-bars dashboard-chart-bars--overlapped"
                          title={[
                            item.title,
                            `Pemasukan: ${formatCurrency(item.income, currency)}`,
                            `Pengeluaran: ${formatCurrency(item.expense, currency)}`,
                            `Alokasi anggaran bulanan: ${formatCurrency(item.space, currency)}`,
                          ].join(" — ")}
                        >
                          {item.space > 0 && (
                            <div
                              className="dashboard-chart-bar dashboard-chart-bar--space"
                              style={{
                                height: `${Math.min(88, Math.max(0, (item.space / moneyFlowScaleMaximum) * 100))}%`,
                                zIndex: 1,
                              }}
                              aria-hidden="true"
                            />
                          )}
                          {chartSeries.map((series, index) => (
                            <div
                              key={series.key}
                              className={`dashboard-chart-bar ${series.className}`}
                              style={{
                                height: `${Math.min(88, Math.max(0, (series.value / moneyFlowScaleMaximum) * 100))}%`,
                                zIndex: index + 2,
                              }}
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                        <span className="dashboard-chart-month">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </article>
        <article
          className="dashboard-panel dashboard-remaining-panel"
          aria-labelledby="dashboard-remaining-title"
        >
          <div className="dashboard-panel-heading">
            <div>
              <h3 id="dashboard-remaining-title">Remaining Monthly</h3>
            </div>
            <Link className="dashboard-panel-link" to="/budgets">
              Budget setting <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="dashboard-remaining-main">
            <div>
              <strong className="dashboard-remaining-percent">
                {budgetTotals.remainingPercentage === null
                  ? "—"
                  : formatPercent(budgetTotals.remainingPercentage)}
              </strong>
              <span className="dashboard-remaining-percent-caption">
                Monthly budget remaining
              </span>
              <div className="dashboard-reference-additional-stat">
                <span aria-hidden="true">◈</span>
                <span>Additional AVG</span>
                <strong
                  className={
                    budgetUsageChange === null
                      ? "is-muted"
                      : budgetUsageChange > 0
                        ? "is-negative"
                        : "is-positive"
                  }
                >
                  {budgetUsageChange === null
                    ? "—"
                    : `${budgetUsageChange > 0 ? "+" : ""}${budgetUsageChange.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`}
                </strong>
              </div>
            </div>
            <p className="dashboard-remaining-copy">
              {!budgetLoaded || budgetTotals.totalBudget <= 0
                ? "Tetapkan anggaran bulanan untuk mulai memantau kesehatan pengeluaran Anda."
                : budgetTotals.usagePercentage !== null &&
                    budgetTotals.usagePercentage > 100
                  ? "Pengeluaran telah melampaui total alokasi. Tinjau kembali prioritas dan penyesuaian anggaran Anda."
                  : budgetTotals.usagePercentage !== null &&
                      budgetTotals.usagePercentage >= 80
                    ? "Anggaran mulai mendekati batas. Pertahankan pengeluaran pada kategori prioritas hingga akhir periode."
                    : budgetTotals.usagePercentage !== null &&
                        budgetTotals.usagePercentage <= 50
                      ? "Kondisi anggaran terjaga dengan baik. Penggunaan masih terkendali dan sebagian besar alokasi belum terealisasi."
                      : "Penggunaan anggaran masih terkendali. Pantau pengeluaran secara berkala agar tetap sesuai rencana."}
            </p>
          </div>

          <div className="dashboard-reference-budget-tiles dashboard-reference-budget-tiles--top-budgets">
            {topBudgetAllocations.length > 0 ? (
              topBudgetAllocations.map((budget, index) => {
                const usage = Math.max(0, toAmount(budget.usagePercentage));
                const cappedUsage = Math.min(100, usage);
                return (
                  <div
                    className={`dashboard-reference-budget-tile dashboard-reference-budget-tile--top-${index + 1}`}
                    key={budget.budgetId}
                  >
                    <strong>{formatPercent(usage)}</strong>
                    <span title={budget.categoryName}>
                      {budget.categoryName}
                    </span>
                    <small>
                      {formatCompactCurrency(budget.actualAmount, currency)} /{" "}
                      {formatCompactCurrency(budget.budgetAmount, currency)}
                    </small>
                    <div className="dashboard-reference-budget-track">
                      <i style={{ width: `${cappedUsage}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="dashboard-remaining-no-budgets">
                {budgetLoaded
                  ? "Belum ada alokasi anggaran untuk periode ini."
                  : "Memuat alokasi anggaran…"}
              </div>
            )}
          </div>
        </article>
      </section>

      <section
        className="dashboard-panel dashboard-recent-transactions"
        aria-labelledby="dashboard-recent-transactions-title"
      >
        <div className="dashboard-panel-heading dashboard-recent-heading">
          <div>
            <h3 id="dashboard-recent-transactions-title">
              Transaction History
            </h3>
            <p>Lima transaksi terbaru dari aktivitas keuangan Anda.</p>
          </div>
          <Link className="dashboard-panel-link" to="/transactions">
            Semua transaksi <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="dashboard-recent-table-wrap">
          <table className="dashboard-recent-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Transaction</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactionsLoading ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dashboard-recent-state" role="status">
                      Memuat transaksi terbaru…
                    </div>
                  </td>
                </tr>
              ) : recentTransactionsError ? (
                <tr>
                  <td colSpan={6}>
                    <div
                      className="dashboard-recent-state dashboard-recent-state--error"
                      role="status"
                    >
                      {recentTransactionsError}
                    </div>
                  </td>
                </tr>
              ) : recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dashboard-recent-state">
                      Belum ada transaksi aktif.
                    </div>
                  </td>
                </tr>
              ) : (
                recentTransactions.map((transaction) => {
                  const typeLabel =
                    transaction.type === "INCOME"
                      ? "Pemasukan"
                      : transaction.type === "EXPENSE"
                        ? "Pengeluaran"
                        : "Transfer";
                  const dateLabel = new Intl.DateTimeFormat("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Jakarta",
                  }).format(new Date(transaction.transactionDate));
                  return (
                    <tr key={transaction.id}>
                      <td>
                        <div className="dashboard-recent-name">
                          <span
                            className={`dashboard-recent-type-icon dashboard-recent-type-icon--${transaction.type.toLowerCase()}`}
                          >
                            {transaction.type === "INCOME"
                              ? "↗"
                              : transaction.type === "EXPENSE"
                                ? "↘"
                                : "⇄"}
                          </span>
                          <strong>
                            {transaction.description?.trim() || typeLabel}
                          </strong>
                        </div>
                      </td>
                      <td>{dateLabel}</td>
                      <td>
                        <span
                          className={`dashboard-recent-type dashboard-recent-type--${transaction.type.toLowerCase()}`}
                        >
                          {typeLabel}
                        </span>
                      </td>
                      <td>
                        <strong
                          className={`dashboard-recent-amount dashboard-recent-amount--${transaction.type.toLowerCase()}`}
                        >
                          {transaction.type === "INCOME"
                            ? "+"
                            : transaction.type === "EXPENSE"
                              ? "−"
                              : ""}
                          {formatCurrency(
                            transaction.amount,
                            transaction.currency,
                          )}
                        </strong>
                      </td>
                      <td>
                        <span
                          className={`dashboard-recent-status dashboard-recent-status--${transaction.status.toLowerCase()}`}
                        >
                          {transaction.status === "ACTIVE"
                            ? "Aktif"
                            : transaction.status === "VOIDED"
                              ? "Dibatalkan"
                              : transaction.status}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="dashboard-recent-action"
                          to={`/transactions/${encodeURIComponent(transaction.id)}`}
                          aria-label={`Lihat transaksi ${transaction.description || typeLabel}`}
                        >
                          Detail <span aria-hidden="true">→</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="dashboard-activity-card-section"
        aria-label="Aktivitas keuangan"
      >
        <article className="dashboard-expense-card">
          <div className="dashboard-expense-card-heading">
            <div>
              <span className="dashboard-card-overline">ACTIVITY</span>
              <h2>Aktivitas keuangan</h2>
            </div>
            <span className="dashboard-expense-icon" aria-hidden="true">
              ◷
            </span>
          </div>

          <div className="dashboard-transaction-count">
            <strong>
              {isLoading && !overview
                ? "—"
                : summary
                  ? formatNumber(summary.transactionCount)
                  : "—"}
            </strong>
            <span>transaksi tercatat</span>
          </div>

          <div className="dashboard-activity-meter">
            <div className="dashboard-activity-meter-track">
              <span style={{ width: `${savingsRate}%` }} />
            </div>
            <div className="dashboard-activity-meter-labels">
              <span>Arus kas tersisa</span>
              <strong>{summary ? formatPercent(savingsRate) : "—"}</strong>
            </div>
          </div>

          <p className="dashboard-expense-card-note">
            Persentase dihitung dari arus kas bersih dibandingkan pemasukan.
          </p>
        </article>
      </section>

      <section
        className="dashboard-module-section"
        aria-label="Transaksi berulang"
      >
        <RecurringPerformanceSection />
      </section>

      <section
        className="dashboard-module-section"
        aria-label="Analitik arus kas"
      >
        <CashFlowAnalyticsSection
          cashFlow={overview?.cashFlow ?? null}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onRefresh={() => setReloadKey((current) => current + 1)}
        />
      </section>

      <footer className="dashboard-footer">
        <span className="dashboard-footer-mark" aria-hidden="true">
          ✳
        </span>
        <div>
          <strong>Keuangan lebih terarah, keputusan lebih baik.</strong>
          <p>
            Angka dan analitik mengikuti data yang dikembalikan oleh backend
            Anda.
          </p>
        </div>
        <span className="dashboard-footer-currency">{currency}</span>
      </footer>
    </main>
  );
}
