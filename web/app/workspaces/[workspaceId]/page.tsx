"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  statusOrder,
  themeKey,
  tokenKey,
  type Project,
  type Task,
  type User,
  type Workspace,
  type WorkspaceMember
} from "../../lib/api";
import { notifyAuthChanged } from "../../lib/auth";
import { Sidebar } from "../../components/sidebar";

function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function WorkspaceDetailPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = Number(params.workspaceId);
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return Boolean(window.localStorage.getItem(tokenKey));
  });

  const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
  const openTasks = tasks.filter((task) => task.status !== "Done");
  const counts = useMemo(
    () =>
      statusOrder.map((status) => ({
        status,
        count: tasks.filter((task) => task.status === status).length
      })),
    [tasks]
  );

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
        const currentWorkspace = workspaceData.find((item) => item.id === workspaceId);
        if (!currentWorkspace) {
          setProjects([]);
          setTasks([]);
          setMembers([]);
          setIsLoading(false);
          return null;
        }
        return Promise.all([
          apiRequest<Project[]>(`/projects?workspace_id=${workspaceId}`, token),
          apiRequest<Task[]>(`/tasks?workspace_id=${workspaceId}`, token),
          apiRequest<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`, token)
        ]);
      })
      .then((workspaceData) => {
        if (cancelled || workspaceData === null) {
          return;
        }
        const [projectData, taskData, memberData] = workspaceData;
        setProjects(projectData);
        setTasks(taskData);
        setMembers(memberData);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        window.localStorage.removeItem(tokenKey);
        notifyAuthChanged();
        setToken(null);
        setUser(null);
        setWorkspaces([]);
        setProjects([]);
        setTasks([]);
        setMembers([]);
        setIsLoading(false);
        setMessage(error instanceof Error ? error.message : "Could not load workspace.");
      });

    return () => {
      cancelled = true;
    };
  }, [token, workspaceId]);

  function clearSession() {
    window.localStorage.removeItem(tokenKey);
    notifyAuthChanged();
    setToken(null);
    setUser(null);
    setWorkspaces([]);
    setProjects([]);
    setTasks([]);
    setMembers([]);
    setIsLoading(false);
    setMessage("Signed out.");
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <Sidebar active="workspace" workspace={workspace} userName={user?.name} />

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>{workspace?.name ?? "Workspace"}</h1>
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
              <h2>Sign in to view this workspace</h2>
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
            <p className="empty-state">Loading workspace...</p>
          </section>
        ) : null}

        {token && !isLoading && !workspace ? (
          <section className="panel empty-panel">
            <div>
              <p className="eyebrow">Not found</p>
              <h2>Workspace not found</h2>
              <p className="form-message">You may not have access to this workspace.</p>
            </div>
            <Link className="button-link" href="/">
              Go to dashboard
            </Link>
          </section>
        ) : null}

        {token && !isLoading && workspace ? (
          <>
            <section className="metrics" aria-label="Workspace summary">
              <article>
                <span>Projects</span>
                <strong>{projects.length}</strong>
              </article>
              <article>
                <span>Members</span>
                <strong>{members.length}</strong>
              </article>
              <article>
                <span>Open tasks</span>
                <strong>{openTasks.length}</strong>
              </article>
              <article>
                <span>Your role</span>
                <strong>{formatRole(workspace.role)}</strong>
              </article>
            </section>

            <section className="main-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Projects</p>
                    <h2>Workspace projects</h2>
                  </div>
                  <Link className="secondary-button compact-button button-link-muted" href="/projects">
                    View all
                  </Link>
                </div>
                <div className="project-list">
                  {projects.map((project) => {
                    const projectTasks = tasks.filter((task) => task.project_id === project.id);
                    const openProjectTasks = projectTasks.filter((task) => task.status !== "Done");
                    return (
                      <Link className="project-item" href={`/projects/${project.id}`} key={project.id}>
                        <div>
                          <h3>{project.name}</h3>
                          <p>{project.description || "No description"}</p>
                        </div>
                        <span className="health">{openProjectTasks.length} open</span>
                      </Link>
                    );
                  })}
                  {projects.length === 0 ? <p className="empty-state">No projects yet.</p> : null}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Workflow</p>
                    <h2>Task status</h2>
                  </div>
                  <span>{tasks.length} tasks</span>
                </div>
                <div className="status-list">
                  {counts.map((item) => (
                    <div className="status-row" key={item.status}>
                      <span>{item.status}</span>
                      <div className="status-track">
                        <span style={{ width: `${Math.max(item.count, 1) * 20}%` }} />
                      </div>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              </section>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Members</p>
                  <h2>Workspace access</h2>
                </div>
                <Link className="secondary-button compact-button button-link-muted" href="/members">
                  Manage members
                </Link>
              </div>
              <div className="member-list">
                {members.map((member) => (
                  <Link className="member-row" href={`/members/${member.id}`} key={member.id}>
                    <div>
                      <strong>{member.name}</strong>
                      <small>{member.email}</small>
                    </div>
                    <span className="status-pill" data-status={member.role}>{member.role}</span>
                  </Link>
                ))}
                {members.length === 0 ? <p className="empty-state">No members loaded.</p> : null}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
