import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { ProtectedRoute } from "../components/auth/ProtectedRoute";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { RegisterSuccessPage } from "../pages/RegisterSuccessPage";
import { VerifyEmailPage } from "../pages/VerifyEmailPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { TransactionsPage } from "../pages/TransactionsPage";
import { TransactionFormPage } from "../pages/TransactionFormPage";
import { TransactionDetailPage } from "../pages/TransactionDetailPage";
import { TransferFormPage } from "../pages/TransferFormPage";
import { EditTransactionPage } from "../pages/EditTransactionPage";
import { AccountsPage } from "../pages/AccountsPage";
import { AccountDetailPage } from "../pages/AccountDetailPage";
import { ReportsPage } from "../pages/ReportsPage";
import { NotificationsPage } from "../pages/NotificationsPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/register/success",
    element: <RegisterSuccessPage />,
  },
  {
    path: "/verify-email",
    element: <VerifyEmailPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: "transactions",
            element: <TransactionsPage />,
          },
          {
            path: "transactions/new",
            element: <TransactionFormPage />,
          },
          {
            path: "transactions/transfer",
            element: <TransferFormPage />,
          },
          {
            path: "transactions/:id/edit",
            element: <EditTransactionPage />,
          },
          {
            path: "transactions/:id",
            element: <TransactionDetailPage />,
          },
          {
            path: "accounts",
            element: <AccountsPage />,
          },
          {
            path: "accounts/:id",
            element: <AccountDetailPage />,
          },
          {
            path: "reports",
            element: <ReportsPage />,
          },
          {
            path: "notifications",
            element: <NotificationsPage />,
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
