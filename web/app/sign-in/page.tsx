"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest, tokenKey, type User } from "../lib/api";
import { notifyAuthChanged } from "../lib/auth";

type AuthResponse = {
  access_token: string;
  user: User;
};

export default function SignIn() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function saveSession(response: AuthResponse) {
    window.localStorage.setItem(tokenKey, response.access_token);
    notifyAuthChanged();
    router.replace("/");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);
    try {
      const response =
        mode === "login"
          ? await apiRequest<AuthResponse>("/auth/login", null, {
              method: "POST",
              body: JSON.stringify({ email, password })
            })
          : await apiRequest<AuthResponse>("/auth/register", null, {
              method: "POST",
              body: JSON.stringify({ email, name, password, workspace_name: workspaceName })
            });
      saveSession(response);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : mode === "login"
            ? "Login failed."
            : "Registration failed."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="panel form-panel auth-panel" onSubmit={handleSubmit}>
        <div className="brand">
          <span className="brand-mark">A</span>
          <div>
            <strong>Ameo</strong>
            <span>Project workspace</span>
          </div>
        </div>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Account</p>
            <h2>{mode === "login" ? "Sign in" : "Create workspace"}</h2>
          </div>
        </div>
        {mode === "register" ? (
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            autoComplete="name"
            required
          />
        ) : null}
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          type="email"
          autoComplete="email"
          required
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
        {mode === "register" ? (
          <input
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            placeholder="Workspace name"
            required
          />
        ) : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Please wait" : mode === "login" ? "Sign in" : "Register"}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setMessage("");
          }}
        >
          {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
        </button>
        {message ? <p className="form-message">{message}</p> : null}
      </form>
    </main>
  );
}
