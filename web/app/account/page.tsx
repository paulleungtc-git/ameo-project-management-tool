"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest, themeKey, tokenKey, type User } from "../lib/api";

export default function AccountPage() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const storedTheme = window.localStorage.getItem(themeKey);
    return storedTheme === "dark" || storedTheme === "light" ? storedTheme : "light";
  });
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(tokenKey);
  });
  const [user, setUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return Boolean(window.localStorage.getItem(tokenKey));
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(themeKey, theme);
  }, [theme]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    apiRequest<User>("/auth/me", token)
      .then((currentUser) => {
        if (cancelled) {
          return;
        }
        setUser(currentUser);
        setProfileName(currentUser.name);
        setProfileEmail(currentUser.email);
        setProfileMessage("");
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        window.localStorage.removeItem(tokenKey);
        setToken(null);
        setUser(null);
        setIsLoading(false);
        setProfileMessage(error instanceof Error ? error.message : "Could not load account.");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  function clearSession() {
    window.localStorage.removeItem(tokenKey);
    setToken(null);
    setUser(null);
    setProfileName("");
    setProfileEmail("");
    setProfileMessage("Signed out.");
  }

  async function handleUpdateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !profileName.trim() || !profileEmail.trim()) {
      return;
    }
    setProfileMessage("");
    setIsSavingProfile(true);
    try {
      const updated = await apiRequest<User>("/users/me", token, {
        method: "PATCH",
        body: JSON.stringify({
          email: profileEmail.trim(),
          name: profileName.trim()
        })
      });
      setUser(updated);
      setProfileName(updated.name);
      setProfileEmail(updated.email);
      setProfileMessage("Profile updated.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Could not update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleUpdatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !currentPassword || !newPassword || !confirmPassword) {
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("New passwords do not match.");
      return;
    }
    setPasswordMessage("");
    setIsSavingPassword(true);
    try {
      await apiRequest<undefined>("/users/me/password", token, {
        method: "PATCH",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated.");
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : "Could not update password.");
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="brand">
          <span className="brand-mark">A</span>
          <div>
            <strong>Ameo</strong>
            <span>Project workspace</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Primary">
          <Link href="/">Dashboard</Link>
          <Link href="/#projects">Projects</Link>
          <Link href="/#tasks">Tasks</Link>
          <Link href="/members">Members</Link>
          <Link className="active" href="/account">
            Account
          </Link>
        </nav>
        <div className="workspace-card">
          <span>Signed in as</span>
          <strong>{user?.name ?? "Not signed in"}</strong>
          <p>{user?.email ?? "Use the dashboard login form first"}</p>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">User settings</p>
            <h1>Account</h1>
          </div>
          <div className="button-row">
            {user ? (
              <button className="secondary-button" type="button" onClick={clearSession}>
                Sign out
              </button>
            ) : null}
            <button
              className="secondary-button"
              type="button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? "Dark" : "Light"}
            </button>
          </div>
        </header>

        {!token ? (
          <section className="panel empty-panel">
            <div>
              <p className="eyebrow">Signed out</p>
              <h2>Sign in to update your account</h2>
              <p className="form-message">Use the dashboard login form, then return to this page.</p>
            </div>
            <Link className="button-link" href="/">
              Go to dashboard
            </Link>
            {profileMessage ? <p className="form-message">{profileMessage}</p> : null}
          </section>
        ) : null}

        {token && isLoading ? (
          <section className="panel">
            <p className="empty-state">Loading account...</p>
          </section>
        ) : null}

        {token && !isLoading && user ? (
          <section className="main-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Profile</p>
                  <h2>Name and email</h2>
                </div>
              </div>
              <form className="form-panel" onSubmit={handleUpdateProfile}>
                <input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Name"
                  disabled={isSavingProfile}
                />
                <input
                  value={profileEmail}
                  onChange={(event) => setProfileEmail(event.target.value)}
                  placeholder="Email"
                  type="email"
                  disabled={isSavingProfile}
                />
                <button type="submit" disabled={!profileName.trim() || !profileEmail.trim() || isSavingProfile}>
                  {isSavingProfile ? "Saving" : "Save profile"}
                </button>
                {profileMessage ? <p className="form-message">{profileMessage}</p> : null}
              </form>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Security</p>
                  <h2>Password</h2>
                </div>
              </div>
              <form className="form-panel" onSubmit={handleUpdatePassword}>
                <input
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Current password"
                  type="password"
                  disabled={isSavingPassword}
                />
                <input
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="New password"
                  type="password"
                  disabled={isSavingPassword}
                />
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  type="password"
                  disabled={isSavingPassword}
                />
                <button
                  type="submit"
                  disabled={!currentPassword || !newPassword || !confirmPassword || isSavingPassword}
                >
                  {isSavingPassword ? "Saving" : "Save password"}
                </button>
                {passwordMessage ? <p className="form-message">{passwordMessage}</p> : null}
              </form>
            </section>
          </section>
        ) : null}
      </section>
    </main>
  );
}
