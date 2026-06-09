"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  themeKey,
  tokenKey,
  type Task,
  type User,
  type Workspace,
  type WorkspaceMember
} from "../lib/api";

type RoleFilter = "all" | "owner" | "admin" | "member";

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

export default function MembersPage() {
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
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return Boolean(window.localStorage.getItem(tokenKey));
  });
  const [isAdding, setIsAdding] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<number | null>(null);

  const workspace = workspaces[0] ?? null;
  const canManageMembers = workspace?.role === "owner" || workspace?.role === "admin";
  const ownerCount = members.filter((member) => member.role === "owner").length;

  const openTaskCountByUserId = useMemo(() => {
    const counts = new Map<number, number>();
    for (const task of tasks) {
      if (task.status === "Done" || task.assignee_id === null) {
        continue;
      }
      counts.set(task.assignee_id, (counts.get(task.assignee_id) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);

  const filteredMembers = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return members.filter((member) => {
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      const matchesSearch =
        query.length === 0 ||
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query);
      return matchesRole && matchesSearch;
    });
  }, [members, roleFilter, searchText]);

  const summary = useMemo(
    () => ({
      admins: members.filter((member) => member.role === "admin").length,
      members: members.filter((member) => member.role === "member").length,
      openTasks: tasks.filter((task) => task.status !== "Done").length,
      owners: ownerCount
    }),
    [members, ownerCount, tasks]
  );

  const reloadWorkspaceResources = useCallback(async () => {
    if (!token || !workspace) {
      return;
    }
    const [memberData, taskData] = await Promise.all([
      apiRequest<WorkspaceMember[]>(`/workspaces/${workspace.id}/members`, token),
      apiRequest<Task[]>(`/tasks?workspace_id=${workspace.id}`, token)
    ]);
    setMembers(memberData);
    setTasks(taskData);
  }, [token, workspace]);

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
          setMessage("");
          setIsLoading(false);
          return null;
        }
        return Promise.all([
          apiRequest<WorkspaceMember[]>(`/workspaces/${currentWorkspace.id}/members`, token),
          apiRequest<Task[]>(`/tasks?workspace_id=${currentWorkspace.id}`, token)
        ]);
      })
      .then((workspaceData) => {
        if (cancelled || workspaceData === null) {
          return;
        }
        const [memberData, taskData] = workspaceData;
        setMembers(memberData);
        setTasks(taskData);
        setMessage("");
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
        setMessage(error instanceof Error ? error.message : "Could not load members.");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

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

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !workspace || !canManageMembers || !memberEmail.trim()) {
      return;
    }
    setMessage("");
    setIsAdding(true);
    try {
      const member = await apiRequest<WorkspaceMember>(`/workspaces/${workspace.id}/members`, token, {
        method: "POST",
        body: JSON.stringify({ email: memberEmail.trim(), role: memberRole })
      });
      setMembers((current) => [member, ...current.filter((item) => item.id !== member.id)]);
      setMemberEmail("");
      setMessage("Member added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add member.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleUpdateMemberRole(member: WorkspaceMember, role: string) {
    if (!token || !workspace || !canManageMembers || role === member.role) {
      return;
    }
    setMessage("");
    setBusyMemberId(member.id);
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
      setMessage("Member role updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update member.");
      await reloadWorkspaceResources();
    } finally {
      setBusyMemberId(null);
    }
  }

  async function handleRemoveMember(member: WorkspaceMember) {
    if (!token || !workspace || !canManageMembers) {
      return;
    }
    if (member.user_id === user?.id) {
      setMessage("You cannot remove yourself from this page.");
      return;
    }
    const confirmed = window.confirm(`Remove ${member.name} from ${workspace.name}?`);
    if (!confirmed) {
      return;
    }
    setMessage("");
    setBusyMemberId(member.id);
    try {
      await apiRequest<undefined>(`/workspaces/${workspace.id}/members/${member.id}`, token, {
        method: "DELETE"
      });
      setMembers((current) => current.filter((item) => item.id !== member.id));
      setMessage("Member removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove member.");
    } finally {
      setBusyMemberId(null);
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
            <p className="eyebrow">Workspace access</p>
            <h1>Members</h1>
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
              <h2>Sign in to manage workspace members</h2>
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
            <p className="empty-state">Loading members...</p>
          </section>
        ) : null}

        {token && !isLoading && !workspace ? (
          <section className="panel empty-panel">
            <div>
              <p className="eyebrow">No workspace</p>
              <h2>No workspace membership found</h2>
              <p className="form-message">Create a workspace from the dashboard before adding members.</p>
            </div>
            <Link className="button-link" href="/">
              Go to dashboard
            </Link>
          </section>
        ) : null}

        {token && !isLoading && workspace ? (
          <>
            <section className="metrics" aria-label="Member summary">
              <article>
                <span>Total members</span>
                <strong>{members.length}</strong>
              </article>
              <article>
                <span>Owners</span>
                <strong>{summary.owners}</strong>
              </article>
              <article>
                <span>Admins</span>
                <strong>{summary.admins}</strong>
              </article>
              <article>
                <span>Open tasks</span>
                <strong>{summary.openTasks}</strong>
              </article>
            </section>

            <section className="member-management-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Directory</p>
                    <h2>Workspace members</h2>
                  </div>
                  <span>{filteredMembers.length} shown</span>
                </div>
                <div className="members-toolbar">
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search by name or email"
                  />
                  <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}>
                    <option value="all">All roles</option>
                    <option value="owner">Owners</option>
                    <option value="admin">Admins</option>
                    <option value="member">Members</option>
                  </select>
                </div>

                <div className="member-table" role="table" aria-label="Workspace members">
                  <div className="member-table-row member-table-header" role="row">
                    <span role="columnheader">Member</span>
                    <span role="columnheader">Role</span>
                    <span role="columnheader">Open tasks</span>
                    <span role="columnheader">Joined</span>
                    <span role="columnheader">Actions</span>
                  </div>
                  {filteredMembers.map((member) => {
                    const isCurrentUser = member.user_id === user?.id;
                    const isBusy = busyMemberId === member.id;
                    const cannotManageReason = !canManageMembers ? "Only owners and admins can manage members." : undefined;
                    return (
                      <article className="member-table-row" key={member.id} role="row">
                        <div className="member-identity" role="cell">
                          <Link className="member-profile-link" href={`/members/${member.id}`}>
                            <strong>{member.name}</strong>
                          </Link>
                          <small>{member.email}</small>
                        </div>
                        <div role="cell">
                          <select
                            value={member.role}
                            onChange={(event) => handleUpdateMemberRole(member, event.target.value)}
                            disabled={!canManageMembers || isBusy}
                            title={cannotManageReason}
                          >
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>
                                {formatRole(role)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <strong role="cell">{openTaskCountByUserId.get(member.user_id) ?? 0}</strong>
                        <span role="cell">{formatJoinedDate(member.created_at)}</span>
                        <div className="member-actions" role="cell">
                          {isCurrentUser ? (
                            <Link className="secondary-button compact-button button-link-muted" href={`/members/${member.id}`}>
                              Open profile
                            </Link>
                          ) : (
                            <div className="button-row">
                              <Link className="secondary-button compact-button button-link-muted" href={`/members/${member.id}`}>
                                Open
                              </Link>
                              <button
                                className="secondary-button compact-button"
                                type="button"
                                onClick={() => handleRemoveMember(member)}
                                disabled={!canManageMembers || isBusy}
                                title={cannotManageReason}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  {filteredMembers.length === 0 ? <p className="empty-state">No matching members.</p> : null}
                </div>
              </section>

              <aside className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Access</p>
                    <h2>Add member</h2>
                  </div>
                </div>
                <form className="form-panel" onSubmit={handleAddMember}>
                  <input
                    value={memberEmail}
                    onChange={(event) => setMemberEmail(event.target.value)}
                    placeholder="Existing user email"
                    disabled={!canManageMembers || isAdding}
                  />
                  <select
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value)}
                    disabled={!canManageMembers || isAdding}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                  <button type="submit" disabled={!canManageMembers || !memberEmail.trim() || isAdding}>
                    {isAdding ? "Adding" : "Add member"}
                  </button>
                  {!canManageMembers ? (
                    <p className="form-message">Only owners and admins can add, remove, or change roles.</p>
                  ) : null}
                  {message ? <p className="form-message">{message}</p> : null}
                </form>
              </aside>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
