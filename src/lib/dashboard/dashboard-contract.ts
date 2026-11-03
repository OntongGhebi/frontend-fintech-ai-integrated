import type {
  DashboardBudgetPerformanceResponse,
  DashboardCategoryAnalyticsResponse,
  DashboardCashFlowResponse,
  DashboardOverviewResponse,
} from "../../types/dashboard";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isMoney(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Number.isFinite(Number(value))
  );
}

function isCashFlow(value: unknown): value is DashboardCashFlowResponse {
  if (!isRecord(value)) return false;
  const validPeriod = ["DAY", "WEEK", "MONTH", "YEAR"].includes(
    String(value.period),
  );
  return (
    isString(value.currency) &&
    isString(value.startDate) &&
    isString(value.endDate) &&
    validPeriod &&
    Array.isArray(value.cashFlows) &&
    value.cashFlows.every(
      (item) =>
        isRecord(item) &&
        isString(item.period) &&
        isMoney(item.income) &&
        isMoney(item.expense) &&
        isMoney(item.netCashFlow) &&
        isNumber(item.transactionCount),
    ) &&
    isMoney(value.totalIncome) &&
    isMoney(value.totalExpense) &&
    isMoney(value.totalNetCashFlow) &&
    isNumber(value.totalTransactionCount)
  );
}

export function parseDashboardOverview(
  value: unknown,
): DashboardOverviewResponse {
  if (!isRecord(value))
    throw new Error("Respons dashboard bukan object yang valid.");
  const summary = value.summary;
  const income = value.income;
  const expense = value.expense;
  const categories = value.categoryAnalytics;
  const accounts = value.accountAnalytics;
  const budgets = value.budgetPerformance;
  const recurring = value.recurringPerformance;
  const monthly = value.monthlyFinancialSummary;
  const cashFlow = value.cashFlow;

  if (
    !isString(value.currency) ||
    !isMoney(value.totalCurrentBalance) ||
    !isRecord(summary) ||
    !isString(summary.currency) ||
    !isMoney(summary.totalIncome) ||
    !isMoney(summary.totalExpense) ||
    !isMoney(summary.netCashFlow) ||
    !isNumber(summary.transactionCount) ||
    !isRecord(income) ||
    !isString(income.currency) ||
    !isMoney(income.totalIncome) ||
    !isNumber(income.transactionCount) ||
    !isMoney(income.averageIncome) ||
    !isRecord(expense) ||
    !isString(expense.currency) ||
    !isMoney(expense.totalExpense) ||
    !isNumber(expense.transactionCount) ||
    !isMoney(expense.averageExpense) ||
    !isRecord(categories) ||
    !isString(categories.currency) ||
    !["INCOME", "EXPENSE"].includes(String(categories.type)) ||
    !Array.isArray(categories.categories) ||
    !categories.categories.every(
      (item) =>
        isRecord(item) &&
        isString(item.categoryId) &&
        isString(item.categoryName) &&
        isMoney(item.totalAmount) &&
        isNumber(item.transactionCount) &&
        isMoney(item.percentage),
    ) ||
    !isMoney(categories.totalAmount) ||
    !isNumber(categories.transactionCount) ||
    !isRecord(accounts) ||
    !isString(accounts.currency) ||
    !["INCOME", "EXPENSE"].includes(String(accounts.type)) ||
    !Array.isArray(accounts.accounts) ||
    !accounts.accounts.every(
      (item) =>
        isRecord(item) &&
        isString(item.accountId) &&
        isString(item.accountName) &&
        isMoney(item.totalAmount) &&
        isNumber(item.transactionCount) &&
        isMoney(item.percentage),
    ) ||
    !isMoney(accounts.totalAmount) ||
    !isNumber(accounts.transactionCount) ||
    !isRecord(budgets) ||
    !isString(budgets.currency) ||
    !Array.isArray(budgets.budgets) ||
    !budgets.budgets.every(
      (item) =>
        isRecord(item) &&
        isString(item.budgetId) &&
        isString(item.budgetName) &&
        isString(item.categoryId) &&
        isString(item.categoryName) &&
        isMoney(item.budgetAmount) &&
        isMoney(item.actualAmount) &&
        isMoney(item.remainingAmount) &&
        isMoney(item.usagePercentage) &&
        isNumber(item.transactionCount) &&
        ["ON_TRACK", "NEAR_LIMIT", "OVER_BUDGET"].includes(String(item.status)),
    ) ||
    !isMoney(budgets.totalBudgetAmount) ||
    !isMoney(budgets.totalActualAmount) ||
    !isMoney(budgets.totalRemainingAmount) ||
    !isRecord(recurring) ||
    !isString(recurring.currency) ||
    !Array.isArray(recurring.recurringTransactions) ||
    !recurring.recurringTransactions.every(
      (item) =>
        isRecord(item) &&
        isString(item.recurringTransactionId) &&
        (item.description === null || isString(item.description)) &&
        ["INCOME", "EXPENSE", "TRANSFER"].includes(String(item.type)) &&
        ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(
          String(item.frequency),
        ) &&
        isMoney(item.amount) &&
        isNumber(item.expectedOccurrences) &&
        isNumber(item.executedOccurrences) &&
        isNumber(item.missedOccurrences) &&
        isMoney(item.expectedAmount) &&
        isMoney(item.executedAmount) &&
        isMoney(item.completionPercentage) &&
        ["ON_TRACK", "NEAR_COMPLETE", "UNDERPERFORMING"].includes(
          String(item.status),
        ),
    ) ||
    !isMoney(recurring.totalExpectedAmount) ||
    !isMoney(recurring.totalExecutedAmount) ||
    !isNumber(recurring.totalExpectedOccurrences) ||
    !isNumber(recurring.totalExecutedOccurrences) ||
    !isNumber(recurring.totalMissedOccurrences) ||
    !isRecord(monthly) ||
    !isString(monthly.currency) ||
    !isString(monthly.startDate) ||
    !isString(monthly.endDate) ||
    !Array.isArray(monthly.months) ||
    !monthly.months.every(
      (item) =>
        isRecord(item) &&
        isString(item.month) &&
        isMoney(item.income) &&
        isMoney(item.expense) &&
        isMoney(item.netCashFlow) &&
        isNumber(item.transactionCount) &&
        isMoney(item.savingsRate),
    ) ||
    !isMoney(monthly.totalIncome) ||
    !isMoney(monthly.totalExpense) ||
    !isMoney(monthly.totalNetCashFlow) ||
    !isNumber(monthly.totalTransactionCount) ||
    !isMoney(monthly.averageMonthlyIncome) ||
    !isMoney(monthly.averageMonthlyExpense) ||
    !isCashFlow(cashFlow)
  ) {
    throw new Error(
      "Struktur respons /dashboard/overview tidak sesuai DTO backend.",
    );
  }

  return value as unknown as DashboardOverviewResponse;
}

export function parseCategoryAnalytics(
  value: unknown,
): DashboardCategoryAnalyticsResponse {
  if (
    !isRecord(value) ||
    !isString(value.currency) ||
    !["INCOME", "EXPENSE"].includes(String(value.type)) ||
    !Array.isArray(value.categories) ||
    !value.categories.every(
      (item) =>
        isRecord(item) &&
        isString(item.categoryId) &&
        isString(item.categoryName) &&
        isMoney(item.totalAmount) &&
        isNumber(item.transactionCount) &&
        isMoney(item.percentage),
    ) ||
    !isMoney(value.totalAmount) ||
    !isNumber(value.transactionCount)
  ) {
    throw new Error(
      "Struktur respons /dashboard/categories tidak sesuai DTO backend.",
    );
  }
  return value as unknown as DashboardCategoryAnalyticsResponse;
}

export function parseBudgetPerformance(
  value: unknown,
): DashboardBudgetPerformanceResponse {
  if (
    !isRecord(value) ||
    !isString(value.currency) ||
    !Array.isArray(value.budgets) ||
    !value.budgets.every(
      (item) =>
        isRecord(item) &&
        isString(item.budgetId) &&
        isString(item.budgetName) &&
        isString(item.categoryId) &&
        isString(item.categoryName) &&
        isMoney(item.budgetAmount) &&
        isMoney(item.actualAmount) &&
        isMoney(item.remainingAmount) &&
        isMoney(item.usagePercentage) &&
        isNumber(item.transactionCount) &&
        ["ON_TRACK", "NEAR_LIMIT", "OVER_BUDGET"].includes(String(item.status)),
    ) ||
    !isMoney(value.totalBudgetAmount) ||
    !isMoney(value.totalActualAmount) ||
    !isMoney(value.totalRemainingAmount)
  ) {
    throw new Error(
      "Struktur respons performa anggaran tidak sesuai DTO backend.",
    );
  }
  return value as unknown as DashboardBudgetPerformanceResponse;
}

export function parseCashFlow(value: unknown): DashboardCashFlowResponse {
  if (!isCashFlow(value)) {
    throw new Error("Struktur respons cash flow tidak sesuai DTO backend.");
  }
  return value;
}
