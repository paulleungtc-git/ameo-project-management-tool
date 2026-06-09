"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  themeKey,
  tokenKey,
  type Task,
  type User,
  type Workspace,
  type WorkspaceMember
} from "../../lib/api";

const roleOptions = ["member", "admin", "owner"];

function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatJoinedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

export default function MemberDetailPage() {
  const params = useParams<{ memberId: string }>();
  const router = useRouter();
  const memberId = Number(params.memberId);
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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return Boolean(window.localStorage.getItem(tokenKey));
  });
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const workspace = workspaces[0] ?? null;
  const member = members.find((item) => item.id === memberId) ?? null;
  const isCurrentUser = member?.user_id === user?.id;
  const canManageMembers = workspace?.role === "owner" || workspace?.role === "admin";

  const assignedTasks = useMemo(
    () => tasks.filter((task) => member && task.assignee_id === member.user_id),
    [member, tasks]
  );
  const openAssignedTasks = assignedTasks.filter((task) => task.status !== "Done");

  useEffect(() => {
    window.localStorage.setItem(themeKey, theme);
  }, [theme]);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    Promise.all([apiRequest<User>("/auth/me", token), apiRequest<Workspace[]>("/workspaces", token)])
      .then(([currentUser, workspaceData]) => {
        if (cancelled) {
          return null;
        }
        setUser(currentUser);
        setWorkspaces(workspaceData);
        const currentWorkspace = workspaceData[0] ?? null;
        if (!currentWorkspace) {
          setMembers([]);
          setTasks([]);
          setIsLoading(false);
          return null;
        }
        return Promise.all([
          apiRequest<WorkspaceMember[]>(`/workspaces/${currentWorkspace.id}/members`, token),
          apiRequest<Task[]>(`/tasks?workspace_id=${currentWorkspace.id}`, token)
        ]).then(([memberData, taskData]) => ({ currentUser, memberData, taskData }));
      })
      .then((workspaceData) => {
        if (cancelled || workspaceData === null) {
          return;
        }
        const { currentUser, memberData, taskData } = workspaceData;
        setMembers(memberData);
        setTasks(taskData);
        const currentMember = memberData.find((item) => item.id === memberId);
        if (currentMember?.user_id === currentUser.id) {
          setProfileName(currentMember.name);
          setProfileEmail(currentMember.email);
        }
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        window.localStorage.removeItem(tokenKey);
        setToken(null);
        setUser(null);
        setWorkspaces([]);
        setMembers([]);
        setTasks([]);
        setIsLoading(false);
        setMessage(error instanceof Error ? error.message : "Could not load member.");
      });

    return () => {
      cancelled = true;
    };
  }, [memberId, token]);

  function clearSession() {
    window.localStorage.removeItem(tokenKey);
    setToken(null);
    setUser(null);
    setWorkspaces([]);
    setMembers([]);
    setTasks([]);
    setIsLoading(false);
    setMessage("Signed out.");
  }

  async function handleUpdateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !workspace || !member || !canManageMembers) {
      return;
    }
    const data = new FormData(event.currentTarget);
    const role = String(data.get("role") ?? member.role);
    if (role === member.role) {
      return;
    }
    setMessage("");
    setIsSavingRole(true);
    try {
      const updated = await apiRequest<WorkspaceMember>(`/workspaces/${workspace.id}/members/${member.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ role })
      });
      setMembers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (updated.user_id === user?.id) {
        setWorkspaces((current) =>
          current.map((item) =>
            item.id === updated.workspace_id ? { ...item, role: updated.role } : item
          )
        );
      }
      setMessage("Role updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update role.");
    } finally {
      setIsSavingRole(false);
    }
  }

  async function handleRemoveMember() {
    if (!token || !workspace || !member || !canManageMembers) {
      return;
    }
    if (isCurrentUser) {
      setMessage("You cannot remove yourself from this page.");
      return;
    }
    const confirmed = window.confirm(`Remove ${member.name} from ${workspace.name}?`);
    if (!confirmed) {
      return;
    }
    setMessage("");
    try {
      await apiRequest<undefined>(`/workspaces/${workspace.id}/members/${member.id}`, token, {
        method: "DELETE"
      });
      router.push("/members");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove member.");
    }
  }

  async function handleUpdateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !isCurrentUser || !profileName.trim() || !profileEmail.trim()) {
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
      setMembers((current) =>
        current.map((item) =>
          item.user_id === updated.id ? { ...item, email: updated.email, name: updated.name } : item
        )
      );
      setProfileMessage("Profile updated.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Could not update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleUpdatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !isCurrentUser || !currentPassword || !newPassword || !confirmPassword) {
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
          <Link className="active" href="/members">
            Members
          </Link>
        </nav>
        <div className="workspace-card">
          <span>Current workspace</span>
          <strong>{workspace?.name ?? "Not signed in"}</strong>
          <p>{user ? `${user.name} - ${workspace?.role ?? "member"}` : "Create or sign in first"}</p>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Member profile</p>
            <h1>{member?.name ?? "Member"}</h1>
          </div>
          <div className="button-row">
            <Link className="secondary-button compact-button button-link-muted" href="/members">
              Back to members
            </Link>
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
              <h2>Sign in to view member profiles</h2>
              <p className="form-message">Use the dashboard login form, then return to this page.</p>
            </div>
            <Link className="button-link" href="/">
              Go to dashboard
            </Link>
            {message ? <p className="form-message">{message}</p> : null}
          </section>
        ) : null}

        {token && isLoading ? (
          <section className="panel">
            <p className="empty-state">Loading member...</p>
          </section>
        ) : null}

        {token && !isLoading && !member ? (
          <section className="panel empty-panel">
            <div>
              <p className="eyebrow">Not found</p>
              <h2>Member not found</h2>
              <p className="form-message">This member is not in your current workspace.</p>
            </div>
            <Link className="button-link" href="/members">
              Back to members
            </Link>
          </section>
        ) : null}

        {token && !isLoading && member ? (
          <>
            <section className="metrics" aria-label="Member summary">
              <article>
                <span>Role</span>
                <strong>{formatRole(member.role)}</strong>
              </article>
              <article>
                <span>Open tasks</span>
                <strong>{openAssignedTasks.length}</strong>
              </article>
              <article>
                <span>Total tasks</span>
                <strong>{assignedTasks.length}</strong>
              </article>
              <article>
                <span>Joined</span>
                <strong>{formatJoinedDate(member.created_at)}</strong>
              </article>
            </section>

            <section className="main-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Workspace access</p>
                    <h2>Role</h2>
                  </div>
                </div>
                <form className="form-panel" onSubmit={handleUpdateRole}>
                  <select name="role" defaultValue={member.role} disabled={!canManageMembers || isSavingRole}>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {formatRole(role)}
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={!canManageMembers || isSavingRole}>
                    {isSavingRole ? "Saving" : "Save role"}
                  </button>
                  {!canManageMembers ? (
                    <p className="form-message">Only owners and admins can change roles.</p>
                  ) : null}
                  {message ? <p className="form-message">{message}</p> : null}
                </form>
                <div className="detail-list">
                  <article className="detail-item">
                    <strong>{member.email}</strong>
                    <small>User ID {member.user_id}</small>
                  </article>
                </div>
                {!isCurrentUser ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={handleRemoveMember}
                    disabled={!canManageMembers}
                  >
                    Remove from workspace
                  </button>
                ) : null}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">User profile</p>
                    <h2>{isCurrentUser ? "Name and email" : "Identity"}</h2>
                  </div>
                </div>
                {isCurrentUser ? (
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
                ) : (
                  <div className="detail-list">
                    <article className="detail-item">
                      <strong>{member.name}</strong>
                      <small>{member.email}</small>
                    </article>
                    <p className="form-message">Only this user can edit their own name, email, and password.</p>
                  </div>
                )}
              </section>
            </section>

            {isCurrentUser ? (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Security</p>
                    <h2>Password</h2>
                  </div>
                </div>
                <form className="task-edit-form" onSubmit={handleUpdatePassword}>
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
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
