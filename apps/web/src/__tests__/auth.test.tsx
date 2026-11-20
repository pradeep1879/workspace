import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LoginForm } from "../components/auth/LoginForm";
import { RegisterForm } from "../components/auth/RegisterForm";
import { AuthProvider } from "../context/AuthContext";

describe("Frontend Auth Forms", () => {
  it("renders LoginForm with email and password inputs", () => {
    const handleSwitch = vi.fn();
    render(
      <AuthProvider>
        <LoginForm onSwitchToRegister={handleSwitch} />
      </AuthProvider>,
    );

    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();

    const switchBtn = screen.getByRole("button", { name: /create account/i });
    fireEvent.click(switchBtn);
    expect(handleSwitch).toHaveBeenCalledTimes(1);
  });

  it("renders RegisterForm with name, email and password inputs", () => {
    const handleSwitch = vi.fn();
    render(
      <AuthProvider>
        <RegisterForm onSwitchToLogin={handleSwitch} />
      </AuthProvider>,
    );

    expect(screen.getByPlaceholderText("Alice Cooper")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();

    const switchBtn = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(switchBtn);
    expect(handleSwitch).toHaveBeenCalledTimes(1);
  });
});
