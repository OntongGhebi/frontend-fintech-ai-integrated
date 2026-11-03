import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { ApiRequestError, apiClient } from "../lib/api-client";
import {
  parseCategoryAnalytics,
  parseDashboardOverview,
} from "../lib/dashboard/dashboard-contract";
import type {
  DashboardCategoryAnalyticsResponse,
  DashboardMonthlyFinancialSummaryItem,
  DashboardMonthlyFinancialSummaryResponse,
  DashboardOverviewResponse,
} from "../types/dashboard";
import { BudgetPerformanceSection } from "./dashboard/BudgetPerformanceSection";
import { RecurringPerformanceSection } from "./dashboard/RecurringPerformanceSection";
import { CashFlowAnalyticsSection } from "./dashboard/CashFlowAnalyticsSection";
import "./DashboardPage.css";

type DashboardOverview = DashboardOverviewResponse;
type MonthlyFinancialItem = DashboardMonthlyFinancialSummaryItem;
type MonthlyFinancialSummary = DashboardMonthlyFinancialSummaryResponse;
type CategoryAnalytics = DashboardCategoryAnalyticsResponse;

interface Comparison {
  current: number;
  previous: number;
  difference: number;
  percentage: number | null;
}

interface SpendingCategory {
  id: string;
  name: string;
  amount: number;
  transactionCount: number;
  color: string;
  isOther?: boolean;
}

/**
 * Palet kategori mengikuti identitas visual aplikasi:
 * green, lime, dan variasi warna turunannya.
 */
const CATEGORY_COLORS = [
  "#347b67",
  "#b8df36",
  "#5b9b7f",
  "#8fbd65",
  "#24634f",
] as const;

const OTHER_CATEGORY_COLOR = "#a5b8ad";

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

function formatPeriod(summary?: MonthlyFinancialSummary): string {
  if (!summary?.startDate || !summary.endDate) {
    return "Periode analitik";
  }

  const start = new Date(summary.startDate);
  const end = new Date(summary.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Periode analitik";
  }

  const formatter = new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function getPercentage(value: string | number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(100, Math.max(0, parsed));
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

function getCurrentMonthKey(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return year && month ? `${year}-${month}` : "";
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

function ComparisonHeader({ comparison }: { comparison: Comparison | null }) {
  if (!comparison) {
    return (
      <span
        className="dashboard-comparison-header dashboard-comparison-header--muted"
        title="Data periode terpilih atau periode pembanding belum tersedia"
      >
        <span aria-hidden="true">—</span>
        <span>Belum tersedia</span>
      </span>
    );
  }

  const increased = comparison.difference > 0;
  const decreased = comparison.difference < 0;
  const tone = increased ? "positive" : decreased ? "negative" : "neutral";
  const arrow = increased ? "↗" : decreased ? "↘" : "→";

  return (
    <span
      className={`dashboard-comparison-header dashboard-comparison-header--${tone}`}
      title={`Periode terpilih: ${formatCurrency(comparison.current)}. Periode sebelumnya: ${formatCurrency(comparison.previous)}.`}
      aria-label={
        comparison.percentage === null
          ? `Perubahan nominal ${increased ? "naik" : decreased ? "turun" : "tetap"} dibanding periode sebelumnya`
          : `${increased ? "Naik" : decreased ? "Turun" : "Tetap"} ${formatPercent(Math.abs(comparison.percentage))} dibanding periode sebelumnya`
      }
    >
      <span className="dashboard-comparison-header-icon" aria-hidden="true">
        {arrow}
      </span>
      <strong>
        {comparison.percentage === null
          ? "Baru"
          : `${increased ? "+" : decreased ? "−" : ""}${formatPercent(Math.abs(comparison.percentage))}`}
      </strong>
    </span>
  );
}
function ComparisonDetail({
  comparison,
  currency,
}: {
  comparison: Comparison | null;
  currency: string;
}) {
  if (!comparison) {
    return (
      <p className="dashboard-comparison-detail dashboard-comparison-detail--muted">
        Perbandingan dengan periode sebelumnya belum tersedia.
      </p>
    );
  }

  const increased = comparison.difference > 0;
  const decreased = comparison.difference < 0;
  const sign = increased ? "+" : decreased ? "−" : "";
  const amount = formatCompactCurrency(
    Math.abs(comparison.difference),
    currency,
  );

  return (
    <p
      className={`dashboard-comparison-detail ${
        increased
          ? "dashboard-comparison-detail--positive"
          : decreased
            ? "dashboard-comparison-detail--negative"
            : "dashboard-comparison-detail--neutral"
      }`}
      title={`Nominal periode sebelumnya: ${formatCurrency(comparison.previous, currency)}`}
    >
      <span>
        {sign}
        {amount}
      </span>
      <span>
        {comparison.previous === 0 && comparison.current > 0
          ? "belum ada pada periode sebelumnya"
          : "vs periode sebelumnya"}
      </span>
    </p>
  );
}

function getBudgetSegmentColor(index: number): string {
  const colors = [
    "#27845a",
    "#328b59",
    "#459451",
    "#5da047",
    "#79ad3e",
    "#98b936",
    "#b9c331",
    "#d2c52e",
    "#e0b92c",
    "#e3a52c",
    "#e6922c",
    "#e47d2d",
    "#df692e",
    "#d95332",
    "#d44236",
    "#cc383a",
    "#c62f3d",
    "#bd293e",
    "#b5223d",
    "#ad1f3b",
  ];

  return colors[index] ?? colors[colors.length - 1];
}

function SegmentedBudgetProgress({ percentage }: { percentage: number }) {
  const boundedPercentage = Math.max(0, Math.min(100, percentage));
  const filledSegments = Math.ceil(boundedPercentage / 5);

  return (
    <div
      className="dashboard-segmented-progress"
      role="progressbar"
      aria-label="Penggunaan total anggaran bulanan"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(boundedPercentage)}
      aria-valuetext={`${formatPercent(percentage)} anggaran terpakai`}
    >
      {Array.from({ length: 20 }, (_, index) => {
        const filled = index < filledSegments;

        return (
          <span
            key={index}
            className={`dashboard-segmented-progress-item${filled ? " dashboard-segmented-progress-item--filled" : ""}`}
            style={
              filled
                ? ({
                    "--budget-segment-color": getBudgetSegmentColor(index),
                  } as CSSProperties)
                : undefined
            }
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

/**
 * Menghasilkan gradient berdasarkan proporsi nominal setiap kategori.
 */
function getDonutGradient(categories: SpendingCategory[]): string {
  const total = categories.reduce(
    (sum, category) => sum + Math.max(0, category.amount),
    0,
  );

  if (total <= 0) {
    return "conic-gradient(#e8eaf0 0% 100%)";
  }

  let currentStop = 0;

  const positiveCategories = categories.filter(
    (category) => category.amount > 0,
  );

  const segments = positiveCategories.map((category, index) => {
    const start = currentStop;
    currentStop += (category.amount / total) * 100;

    const end = index === positiveCategories.length - 1 ? 100 : currentStop;

    return `${category.color} ${start}% ${end}%`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function buildSpendingCategories(
  categories: CategoryAnalyticsItem[],
): SpendingCategory[] {
  const sorted = [...categories]
    .map((category) => ({
      ...category,
      amount: Math.max(0, toAmount(category.totalAmount)),
    }))
    .filter((category) => category.amount > 0)
    .sort((first, second) => second.amount - first.amount);

  const topFive: SpendingCategory[] = sorted
    .slice(0, 5)
    .map((category, index) => ({
      id: category.categoryId,
      name: category.categoryName,
      amount: category.amount,
      transactionCount: category.transactionCount,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));

  const remaining = sorted.slice(5);

  if (remaining.length > 0) {
    const remainingAmount = remaining.reduce(
      (sum, category) => sum + category.amount,
      0,
    );

    const remainingTransactions = remaining.reduce(
      (sum, category) => sum + category.transactionCount,
      0,
    );

    if (remainingAmount > 0) {
      topFive.push({
        id: "__other_expense_categories__",
        name: "Lainnya",
        amount: remainingAmount,
        transactionCount: remainingTransactions,
        color: OTHER_CATEGORY_COLOR,
        isOther: true,
      });
    }
  }

  return topFive;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthRange(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  };
}

function getPeriodLabel(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return "Periode analitik";
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Periode analitik";
  }
  const formatter = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  if (startDate === endDate) return formatter.format(start);
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [previousOverview, setPreviousOverview] =
    useState<DashboardOverview | null>(null);
  const [incomeAnalytics, setIncomeAnalytics] =
    useState<CategoryAnalytics | null>(null);
  const [budgetLoaded, setBudgetLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<"6" | "12">("12");
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

  const summary = overview?.summary;
  const monthlySummary = overview?.monthlyFinancialSummary;
  const categoryAnalytics = overview?.categoryAnalytics;
  const currency = overview?.currency ?? "IDR";
  const allMonths = monthlySummary?.months ?? [];

  const months = useMemo(
    () => allMonths.slice(-Number(selectedPeriod)),
    [allMonths, selectedPeriod],
  );

  const expenseCategories = useMemo(
    () =>
      [...(categoryAnalytics?.categories ?? [])]
        .filter((item) => toAmount(item.totalAmount) > 0)
        .sort(
          (first, second) =>
            toAmount(second.totalAmount) - toAmount(first.totalAmount),
        ),
    [categoryAnalytics?.categories],
  );

  const spendingCategories = useMemo(
    () => buildSpendingCategories(expenseCategories),
    [expenseCategories],
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

    return {
      totalBudget,
      totalActual,
      remaining: toAmount(performance?.totalRemainingAmount),
      usagePercentage:
        totalBudget > 0 ? (totalActual / totalBudget) * 100 : null,
    };
  }, [overview?.budgetPerformance]);

  const currentMonthKey = getCurrentMonthKey();

  const currentMonthBudgetTarget =
    budgetLoaded && budgetTotals.totalBudget > 0
      ? budgetTotals.totalBudget
      : null;

  const maxMonthlyAmount = Math.max(
    1,
    ...months.flatMap((month) => {
      const amounts = [toAmount(month.income), toAmount(month.expense)];

      if (
        month.month === currentMonthKey &&
        currentMonthBudgetTarget !== null
      ) {
        amounts.push(currentMonthBudgetTarget);
      }

      return amounts;
    }),
  );

  const hasMonthlyTransactions = months.some(
    (month) => toAmount(month.income) > 0 || toAmount(month.expense) > 0,
  );

  const hasExpenseCategories = spendingCategories.length > 0;
  const hasIncomeCategories = topIncomeCategories.length > 0;

  const donutGradient = useMemo(
    () => getDonutGradient(spendingCategories),
    [spendingCategories],
  );

  const donutTotal = useMemo(
    () =>
      spendingCategories.reduce(
        (total, category) => total + Math.max(0, category.amount),
        0,
      ),
    [spendingCategories],
  );

  const income = toAmount(summary?.totalIncome);
  const cashFlow = toAmount(summary?.netCashFlow);
  const savingsRate =
    income > 0 ? Math.max(0, Math.min(100, (cashFlow / income) * 100)) : 0;

  return (
    <main className="dashboard-page">
      <div className="dashboard-toolbar" aria-label="Kontrol dashboard">
        <div className="dashboard-period-controls">
          <div className="dashboard-toolbar-context">
            <span className="dashboard-live-dot" aria-hidden="true" />
            <span className="dashboard-toolbar-label">Periode analitik</span>
            <strong className="dashboard-period-pill__value">
              {getPeriodLabel(activeRange.startDate, activeRange.endDate)}
            </strong>
          </div>
          <div className="dashboard-period-fields">
            <label className="dashboard-period-mode-label">
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
                <option value="custom">Rentang kustom</option>
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
                          month: "long",
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
                    onChange={(event) => setCustomStartDate(event.target.value)}
                  />
                </label>
                <span
                  className="dashboard-period-date-separator"
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
                  className="dashboard-period-apply"
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
          {periodError && (
            <p className="dashboard-period-error" role="alert">
              {periodError}
            </p>
          )}
        </div>

        <button
          className="dashboard-refresh-button"
          type="button"
          onClick={() => setReloadKey((current) => current + 1)}
          disabled={isLoading}
          aria-label={
            isLoading ? "Dashboard sedang dimuat" : "Perbarui data dashboard"
          }
        >
          <span aria-hidden="true">{isLoading ? "…" : "↻"}</span>
          <span>{isLoading ? "Memuat" : "Perbarui"}</span>
        </button>
      </div>

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
        className="dashboard-summary-layout"
        aria-label="Ringkasan keuangan"
      >
        <article className="dashboard-balance-card">
          <div className="dashboard-balance-card-heading">
            <div>
              <span className="dashboard-card-overline">CURRENT BALANCE</span>
              <h2>Total saldo bersih</h2>
            </div>
            <span className="dashboard-card-icon dashboard-card-icon--light">
              ↗
            </span>
          </div>

          <div
            className="dashboard-balance-value"
            aria-busy={isLoading && !overview}
            aria-live="polite"
          >
            {isLoading && !overview ? (
              <span className="dashboard-skeleton dashboard-skeleton--balance" />
            ) : overview ? (
              formatCurrency(overview.totalCurrentBalance, currency)
            ) : (
              "—"
            )}
          </div>

          <p className="dashboard-balance-description">
            Akumulasi saldo terkini dari seluruh akun aktif Anda.
          </p>

          <div className="dashboard-balance-footer" aria-live="polite">
            <span className="dashboard-balance-footer-icon" aria-hidden="true">
              {overview ? "✓" : "…"}
            </span>
            <span>
              {overview
                ? "Saldo seluruh akun aktif · tidak terikat periode analitik"
                : isLoading
                  ? "Memuat saldo akun…"
                  : "Saldo akun belum tersedia"}
            </span>
          </div>
        </article>

        <div className="dashboard-stat-stack">
          <article className="dashboard-stat-card dashboard-stat-card--lime">
            <div className="dashboard-stat-card-heading">
              <span>Total pemasukan</span>
              <div className="dashboard-stat-heading-right">
                <ComparisonHeader comparison={incomeComparison} />
                <span className="dashboard-stat-icon" aria-hidden="true">
                  ＋
                </span>
              </div>
            </div>

            <strong
              className="dashboard-stat-value"
              aria-busy={isLoading}
              aria-live="polite"
            >
              {isLoading && !overview ? (
                <span className="dashboard-skeleton" />
              ) : summary ? (
                formatCurrency(summary.totalIncome, currency)
              ) : (
                "—"
              )}
            </strong>

            <ComparisonDetail
              comparison={incomeComparison}
              currency={currency}
            />

            <div className="dashboard-income-categories">
              {isLoading && !incomeAnalytics ? (
                <div className="dashboard-empty-state dashboard-empty-state--compact">
                  <p>Memuat kategori pemasukan…</p>
                </div>
              ) : !hasIncomeCategories ? (
                <div className="dashboard-empty-state dashboard-empty-state--compact">
                  <p>Belum ada data kategori pemasukan.</p>
                </div>
              ) : (
                <div className="dashboard-income-category-grid">
                  {topIncomeCategories.map((category, index) => (
                    <div
                      className="dashboard-income-category-card"
                      key={category.categoryId}
                      title={`${category.categoryName}: ${formatCurrency(category.totalAmount, currency)}`}
                    >
                      <div className="dashboard-income-category-topline">
                        <span
                          className={`dashboard-income-category-icon dashboard-income-category-icon--${index + 1}`}
                          aria-hidden="true"
                        >
                          {index === 0 ? "↗" : index === 1 ? "＋" : "◈"}
                        </span>
                        <span>
                          {formatPercent(getPercentage(category.percentage))}
                        </span>
                      </div>

                      <span className="dashboard-income-category-name">
                        {category.categoryName}
                      </span>

                      <strong className="dashboard-income-category-amount">
                        {formatCompactCurrency(category.totalAmount, currency)}
                      </strong>

                      <span className="dashboard-income-category-count">
                        {formatNumber(category.transactionCount)} transaksi
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>

          <article className="dashboard-stat-card dashboard-stat-card--coral">
            <div className="dashboard-stat-card-heading">
              <span>Total pengeluaran</span>
              <div className="dashboard-stat-heading-right">
                <ComparisonHeader comparison={expenseComparison} />
                <span className="dashboard-stat-icon" aria-hidden="true">
                  ↘
                </span>
              </div>
            </div>

            <strong
              className="dashboard-stat-value"
              aria-busy={isLoading}
              aria-live="polite"
            >
              {isLoading && !overview ? (
                <span className="dashboard-skeleton" />
              ) : summary ? (
                formatCurrency(summary.totalExpense, currency)
              ) : (
                "—"
              )}
            </strong>

            <ComparisonDetail
              comparison={expenseComparison}
              currency={currency}
            />

            <div className="dashboard-budget-progress">
              <div className="dashboard-budget-progress-heading">
                <span>Anggaran bulanan</span>
                <strong>
                  {budgetLoaded && budgetTotals.usagePercentage !== null
                    ? formatPercent(budgetTotals.usagePercentage)
                    : "—"}
                </strong>
              </div>

              {budgetLoaded && budgetTotals.totalBudget > 0 ? (
                <>
                  <SegmentedBudgetProgress
                    percentage={budgetTotals.usagePercentage ?? 0}
                  />

                  <div className="dashboard-budget-progress-details">
                    <span>
                      Terpakai{" "}
                      {formatCompactCurrency(
                        budgetTotals.totalActual,
                        currency,
                      )}
                    </span>
                    <span>
                      Anggaran{" "}
                      {formatCompactCurrency(
                        budgetTotals.totalBudget,
                        currency,
                      )}
                    </span>
                  </div>

                  <div className="dashboard-budget-remaining">
                    <span>
                      {budgetTotals.remaining >= 0
                        ? "Sisa anggaran"
                        : "Melebihi anggaran"}
                    </span>
                    <strong>
                      {formatCompactCurrency(
                        Math.abs(budgetTotals.remaining),
                        currency,
                      )}
                    </strong>
                  </div>
                </>
              ) : (
                <p className="dashboard-budget-empty">
                  {budgetLoaded
                    ? "Belum ada anggaran yang ditetapkan."
                    : "Memuat data anggaran…"}
                </p>
              )}
            </div>
          </article>
        </div>
      </section>

      <div className="dashboard-section-title">
        <div>
          <span className="dashboard-eyebrow">YOUR FINANCIAL PERFORMANCE</span>
          <h2>Analitik keuangan</h2>
        </div>
        <span className="dashboard-section-period">
          {formatPeriod(monthlySummary)}
        </span>
      </div>

      <section className="dashboard-primary-grid">
        <article
          className="dashboard-panel dashboard-money-flow"
          aria-labelledby="dashboard-money-flow-title"
        >
          <div className="dashboard-panel-heading dashboard-panel-heading--money-flow">
            <div className="dashboard-money-flow-title">
              <h3 id="dashboard-money-flow-title">Money flow</h3>
            </div>

            <div className="dashboard-money-flow-header-actions">
              <div
                className="dashboard-chart-legend dashboard-chart-legend--inline"
                aria-label="Keterangan grafik"
              >
                <span>
                  <i
                    className="dashboard-legend-dot dashboard-legend-dot--target"
                    aria-hidden="true"
                  />
                  Target anggaran
                </span>

                <span>
                  <i
                    className="dashboard-legend-dot dashboard-legend-dot--income"
                    aria-hidden="true"
                  />
                  Pemasukan
                </span>

                <span>
                  <i
                    className="dashboard-legend-dot dashboard-legend-dot--expense"
                    aria-hidden="true"
                  />
                  Pengeluaran
                </span>
              </div>

              <label className="dashboard-period-select">
                <span className="sr-only">Periode grafik</span>
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
            </div>
          </div>

          {isLoading && !overview ? (
            <div className="dashboard-chart-loading" role="status">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : !overview && errorMessage ? (
            <div className="dashboard-empty-state" role="status">
              <strong>Grafik belum tersedia</strong>
              <p>Data grafik belum berhasil dimuat. Coba perbarui dashboard.</p>
            </div>
          ) : !hasMonthlyTransactions ? (
            <div className="dashboard-empty-state">
              <span className="dashboard-empty-state-icon" aria-hidden="true">
                ↗
              </span>
              <strong>Belum ada aktivitas keuangan</strong>
              <p>
                Grafik akan muncul setelah transaksi tersedia pada periode yang
                dipilih.
              </p>
            </div>
          ) : (
            <div className="dashboard-chart">
              <div className="dashboard-chart-axis" aria-hidden="true">
                <span>{formatCompactCurrency(maxMonthlyAmount, currency)}</span>
                <span>
                  {formatCompactCurrency(maxMonthlyAmount / 2, currency)}
                </span>
                <span>{formatCompactCurrency(0, currency)}</span>
              </div>

              <div
                className="dashboard-chart-plot"
                role="img"
                aria-label={`Grafik batang pemasukan dan pengeluaran selama ${months.length} bulan. Target anggaran hanya ditampilkan untuk bulan berjalan jika tersedia.`}
              >
                <div className="dashboard-chart-gridline dashboard-chart-gridline--one" />
                <div className="dashboard-chart-gridline dashboard-chart-gridline--two" />
                <div className="dashboard-chart-gridline dashboard-chart-gridline--three" />

                <div
                  className="dashboard-chart-columns"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(months.length, 1)}, minmax(0, 1fr))`,
                  }}
                >
                  {months.map((month) => {
                    const monthlyIncome = Math.max(0, toAmount(month.income));
                    const monthlyExpense = Math.max(0, toAmount(month.expense));

                    const monthlyBudgetTarget =
                      month.month === currentMonthKey
                        ? currentMonthBudgetTarget
                        : null;

                    const incomeHeight =
                      (monthlyIncome / maxMonthlyAmount) * 100;
                    const expenseHeight =
                      (monthlyExpense / maxMonthlyAmount) * 100;

                    const targetHeight =
                      monthlyBudgetTarget !== null
                        ? (monthlyBudgetTarget / maxMonthlyAmount) * 100
                        : 0;

                    const monthTitle = formatMonth(month.month);

                    return (
                      <div className="dashboard-chart-column" key={month.month}>
                        <div
                          className="dashboard-chart-bars dashboard-chart-bars--grouped"
                          title={[
                            monthTitle,
                            ...(monthlyBudgetTarget !== null
                              ? [
                                  `Target anggaran: ${formatCurrency(monthlyBudgetTarget, currency)}`,
                                ]
                              : []),
                            `Pemasukan: ${formatCurrency(monthlyIncome, currency)}`,
                            `Pengeluaran: ${formatCurrency(monthlyExpense, currency)}`,
                          ].join(" — ")}
                        >
                          {monthlyBudgetTarget !== null && (
                            <div
                              className="dashboard-chart-bar dashboard-chart-bar--target"
                              style={{ height: `${targetHeight}%` }}
                              aria-hidden="true"
                            />
                          )}

                          <div
                            className="dashboard-chart-bar dashboard-chart-bar--income"
                            style={{ height: `${incomeHeight}%` }}
                            aria-hidden="true"
                          />

                          <div
                            className="dashboard-chart-bar dashboard-chart-bar--expense"
                            style={{ height: `${expenseHeight}%` }}
                            aria-hidden="true"
                          />
                        </div>

                        <span className="dashboard-chart-month">
                          {monthTitle}
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
          className="dashboard-panel dashboard-spending-panel"
          aria-labelledby="dashboard-spending-title"
        >
          <div className="dashboard-panel-heading">
            <div>
              <h3 id="dashboard-spending-title">Spending breakdown</h3>
              <p>Distribusi pengeluaran per kategori.</p>
            </div>
            <span className="dashboard-panel-heading-icon" aria-hidden="true">
              ◌
            </span>
          </div>

          {isLoading && !overview ? (
            <div className="dashboard-category-loading" role="status">
              <span />
              <span />
              <span />
            </div>
          ) : !overview && errorMessage ? (
            <div
              className="dashboard-empty-state dashboard-empty-state--compact"
              role="status"
            >
              <strong>Data kategori belum tersedia</strong>
              <p>Data belum berhasil dimuat. Coba perbarui dashboard.</p>
            </div>
          ) : !hasExpenseCategories ? (
            <div className="dashboard-empty-state dashboard-empty-state--compact">
              <strong>Belum ada data kategori</strong>
              <p>Pengeluaran berkategori akan ditampilkan di bagian ini.</p>
            </div>
          ) : (
            <>
              <div className="dashboard-spending-total">
                <span>Total pengeluaran kategori</span>
                <strong>
                  {formatCurrency(
                    categoryAnalytics?.totalAmount ??
                      spendingCategories.reduce(
                        (total, category) => total + category.amount,
                        0,
                      ),
                    currency,
                  )}
                </strong>
                <small>
                  {categoryAnalytics
                    ? `${formatNumber(categoryAnalytics.transactionCount)} transaksi`
                    : "Data belum tersedia"}
                </small>
              </div>

              <div className="dashboard-spending-breakdown">
                <div className="dashboard-donut-layout">
                  <div
                    className="dashboard-donut"
                    role="img"
                    aria-label={`Diagram donat kategori pengeluaran. Total yang divisualisasikan ${formatCurrency(donutTotal, currency)}.`}
                    style={
                      {
                        "--dashboard-donut-gradient": donutGradient,
                      } as CSSProperties
                    }
                  >
                    <div className="dashboard-donut-center">
                      <span>Total pengeluaran</span>
                      <strong>
                        {formatCompactCurrency(donutTotal, currency)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="dashboard-category-list">
                  {spendingCategories.map((category) => {
                    const share =
                      donutTotal > 0 ? (category.amount / donutTotal) * 100 : 0;

                    return (
                      <div
                        className="dashboard-category-item"
                        key={category.id}
                      >
                        <div className="dashboard-category-heading">
                          <div className="dashboard-category-name">
                            <span
                              className="dashboard-category-dot"
                              style={{ backgroundColor: category.color }}
                              aria-hidden="true"
                            />
                            <strong>{category.name}</strong>
                          </div>
                          <span className="dashboard-category-percentage">
                            {formatPercent(share)}
                          </span>
                        </div>

                        <div
                          className="dashboard-category-track"
                          role="progressbar"
                          aria-label={`Proporsi pengeluaran ${category.name}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Number(share.toFixed(1))}
                        >
                          <span
                            className="dashboard-category-fill"
                            style={{
                              width: `${share}%`,
                              backgroundColor: category.color,
                            }}
                          />
                        </div>

                        <div className="dashboard-category-meta">
                          <span>
                            {formatNumber(category.transactionCount)} transaksi
                          </span>
                          <strong>
                            {formatCompactCurrency(category.amount, currency)}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {spendingCategories.some((category) => category.isOther) ? (
                  <p className="dashboard-donut-note">
                    Kategori dengan nilai lebih kecil digabungkan ke Lainnya.
                  </p>
                ) : (
                  <p className="dashboard-donut-note">
                    Menampilkan seluruh kategori pengeluaran yang tersedia.
                  </p>
                )}
              </div>
            </>
          )}
        </article>

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
        aria-label="Performa anggaran"
      >
        <BudgetPerformanceSection
          performance={overview?.budgetPerformance ?? null}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onRefresh={() => setReloadKey((current) => current + 1)}
        />
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
