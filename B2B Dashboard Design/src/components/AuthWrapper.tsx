import React from "react";
import AuthPage from "../pages/AuthPage";

type Props = {
  children: React.ReactNode;
};

export default function AuthWrapper({ children }: Props) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <AuthPage />;
  }

  return <>{children}</>;
}

