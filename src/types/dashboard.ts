/** Types mirror the NestJS dashboard response DTOs. Monetary values are strings. */
export type TransactionAnalyticsType = "INCOME" | "EXPENSE";
export type CashFlowPeriod = "DAY" | "WEEK" | "MONTH" | "YEAR";
export type BudgetStatus = "ON_TRACK" | "NEAR_LIMIT" | "OVER_BUDGET";
export type RecurringPerformanceStatus =
  | "ON_TRACK"
  | "NEAR_COMPLETE"
  | "UNDERPERFORMING";
export type RecurringFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface DashboardSummaryResponse {
  currency: string;
  totalIncome: string;
  totalExpense: string;
  netCashFlow: string;
  transactionCount: number;
}

export interface DashboardIncomeAnalyticsResponse {
  currency: string;
  totalIncome: string;
  transactionCount: number;
  averageIncome: string;
}

export interface DashboardExpenseAnalyticsResponse {
  currency: string;
  totalExpense: string;
  transactionCount: number;
  averageExpense: string;
}

export interface DashboardCategoryAnalyticsItem {
  categoryId: string;
  categoryName: string;
  totalAmount: string;
  transactionCount: number;
  percentage: string;
}

export interface DashboardCategoryAnalyticsResponse {
  currency: string;
  type: TransactionAnalyticsType;
  categories: DashboardCategoryAnalyticsItem[];
  totalAmount: string;
  transactionCount: number;
}

export interface DashboardAccountAnalyticsItem {
  accountId: string;
  accountName: string;
  totalAmount: string;
  transactionCount: number;
  percentage: string;
}

export interface DashboardAccountAnalyticsResponse {
  currency: string;
  type: TransactionAnalyticsType;
  accounts: DashboardAccountAnalyticsItem[];
  totalAmount: string;
  transactionCount: number;
}

export interface DashboardBudgetPerformanceItem {
  budgetId: string;
  budgetName: string;
  categoryId: string;
  categoryName: string;
  budgetAmount: string;
  actualAmount: string;
  remainingAmount: string;
  usagePercentage: string;
  transactionCount: number;
  status: BudgetStatus;
}

export interface DashboardBudgetPerformanceResponse {
  currency: string;
  budgets: DashboardBudgetPerformanceItem[];
  totalBudgetAmount: string;
  totalActualAmount: string;
  totalRemainingAmount: string;
}

export interface DashboardRecurringPerformanceItem {
  recurringTransactionId: string;
  description: string | null;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  frequency: RecurringFrequency;
  amount: string;
  expectedOccurrences: number;
  executedOccurrences: number;
  missedOccurrences: number;
  expectedAmount: string;
  executedAmount: string;
  completionPercentage: string;
  status: RecurringPerformanceStatus;
}

export interface DashboardRecurringPerformanceResponse {
  currency: string;
  recurringTransactions: DashboardRecurringPerformanceItem[];
  totalExpectedAmount: string;
  totalExecutedAmount: string;
  totalExpectedOccurrences: number;
  totalExecutedOccurrences: number;
  totalMissedOccurrences: number;
}

export interface DashboardMonthlyFinancialSummaryItem {
  month: string;
  income: string;
  expense: string;
  netCashFlow: string;
  transactionCount: number;
  savingsRate: string;
}

export interface DashboardMonthlyFinancialSummaryResponse {
  currency: string;
  startDate: string;
  endDate: string;
  months: DashboardMonthlyFinancialSummaryItem[];
  totalIncome: string;
  totalExpense: string;
  totalNetCashFlow: string;
  totalTransactionCount: number;
  averageMonthlyIncome: string;
  averageMonthlyExpense: string;
}

export interface DashboardCashFlowItem {
  period: string;
  income: string;
  expense: string;
  netCashFlow: string;
  transactionCount: number;
}

export interface DashboardCashFlowResponse {
  currency: string;
  startDate: string;
  endDate: string;
  period: CashFlowPeriod;
  cashFlows: DashboardCashFlowItem[];
  totalIncome: string;
  totalExpense: string;
  totalNetCashFlow: string;
  totalTransactionCount: number;
}

export interface DashboardOverviewResponse {
  currency: string;
  summary: DashboardSummaryResponse;
  income: DashboardIncomeAnalyticsResponse;
  expense: DashboardExpenseAnalyticsResponse;
  categoryAnalytics: DashboardCategoryAnalyticsResponse;
  accountAnalytics: DashboardAccountAnalyticsResponse;
  budgetPerformance: DashboardBudgetPerformanceResponse;
  recurringPerformance: DashboardRecurringPerformanceResponse;
  monthlyFinancialSummary: DashboardMonthlyFinancialSummaryResponse;
  cashFlow: DashboardCashFlowResponse;
}
