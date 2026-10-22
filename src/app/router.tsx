import { createBrowserRouter } from "react-router-dom";

import { ProtectedRoute } from "../components/auth/ProtectedRoute";
import { AppLayout } from "../components/layout/AppLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { RegisterPage } from "../pages/RegisterPage";
import { RegisterSuccessPage } from "../pages/RegisterSuccessPage";
import { TransactionDetailPage } from "../pages/TransactionDetailPage";
import { TransactionsPage } from "../pages/TransactionsPage";
import { VerifyEmailPage } from "../pages/VerifyEmailPage";

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
            path: "transactions/:id",
            element: <TransactionDetailPage />,
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
