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

type ProjectResources = [Task[], WorkspaceMember[]];

function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);
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

  const project = projects.find((item) => item.id === projectId) ?? null;
  const workspace = project ? workspaces.find((item) => item.id === project.workspace_id) ?? null : workspaces[0] ?? null;
  const projectTasks = useMemo(
    () => (project ? tasks.filter((task) => task.project_id === project.id) : []),
    [project, tasks]
  );
  const openTasks = projectTasks.filter((task) => task.status !== "Done");
  const counts = useMemo(
    () =>
      statusOrder.map((status) => ({
        status,
        count: projectTasks.filter((task) => task.status === status).length
      })),
    [projectTasks]
  );

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
          return null;
        }
        setUser(currentUser);
        return apiRequest<Workspace[]>("/workspaces", token);
      })
      .then((workspaceData) => {
        if (cancelled || workspaceData === null) {
          return null;
        }
        setWorkspaces(workspaceData);
        if (workspaceData.length === 0) {
          setProjects([]);
          setTasks([]);
          setMembers([]);
          setIsLoading(false);
          return null;
        }
        return Promise.all(
          workspaceData.map(async (workspaceItem) => {
            const projectData = await apiRequest<Project[]>(`/projects?workspace_id=${workspaceItem.id}`, token);
            return { projectData, workspaceItem };
          })
        );
      })
      .then((workspaceProjectData) => {
        if (cancelled || workspaceProjectData === null) {
          return null;
        }
        const allProjects = workspaceProjectData.flatMap((item) => item.projectData);
        setProjects(allProjects);
        const currentProject = allProjects.find((item) => item.id === projectId);
        if (!currentProject) {
          setTasks([]);
          setMembers([]);
          setIsLoading(false);
          return null;
        }
        return Promise.all([
          apiRequest<Task[]>(`/tasks?workspace_id=${currentProject.workspace_id}&project_id=${currentProject.id}`, token),
          apiRequest<WorkspaceMember[]>(`/workspaces/${currentProject.workspace_id}/members`, token)
        ]) as Promise<ProjectResources>;
      })
      .then((projectData) => {
        if (cancelled || projectData === null) {
          return;
        }
        const [taskData, memberData] = projectData;
        setTasks(taskData);
        setMembers(memberData);
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
        setProjects([]);
        setTasks([]);
        setMembers([]);
        setIsLoading(false);
        setMessage(error instanceof Error ? error.message : "Could not load project.");
      });

    return () => {
      cancelled = true;
    };
  }, [token, projectId]);

  function clearSession() {
    window.localStorage.removeItem(tokenKey);
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
          {workspace ? <Link href={`/workspaces/${workspace.id}`}>Workspace</Link> : null}
          <Link className="active" href="/projects">
            Projects
          </Link>
          <Link href="/#tasks">Tasks</Link>
          <Link href="/members">Members</Link>
        </nav>
        <div className="workspace-card">
          <span>Current project</span>
          <strong>{project?.name ?? "Not found"}</strong>
          <p>{workspace ? `${workspace.name} - ${formatRole(workspace.role)}` : "Create or sign in first"}</p>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Project</p>
            <h1>{project?.name ?? "Project"}</h1>
          </div>
          <div className="button-row">
            {workspace ? (
              <Link className="secondary-button compact-button button-link-muted" href={`/workspaces/${workspace.id}`}>
                Back to workspace
              </Link>
            ) : null}
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
              <h2>Sign in to view this project</h2>
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
            <p className="empty-state">Loading project...</p>
          </section>
        ) : null}

        {token && !isLoading && !project ? (
          <section className="panel empty-panel">
            <div>
              <p className="eyebrow">Not found</p>
              <h2>Project not found</h2>
              <p className="form-message">You may not have access to this project.</p>
            </div>
            <Link className="button-link" href="/">
              Go to dashboard
            </Link>
          </section>
        ) : null}

        {token && !isLoading && project ? (
          <>
            <section className="metrics" aria-label="Project summary">
              <article>
                <span>Open tasks</span>
                <strong>{openTasks.length}</strong>
              </article>
              <article>
                <span>Total tasks</span>
                <strong>{projectTasks.length}</strong>
              </article>
              <article>
                <span>Members</span>
                <strong>{members.length}</strong>
              </article>
              <article>
                <span>Workspace</span>
                <strong>{workspace?.name ?? "Workspace"}</strong>
              </article>
            </section>

            <section className="main-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Details</p>
                    <h2>Project overview</h2>
                  </div>
                </div>
                <div className="detail-list">
                  <article className="detail-item">
                    <strong>{project.name}</strong>
                    <small>{project.description || "No description"}</small>
                  </article>
                  {workspace ? (
                    <Link className="button-link" href={`/workspaces/${workspace.id}`}>
                      Open workspace
                    </Link>
                  ) : null}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Workflow</p>
                    <h2>Task status</h2>
                  </div>
                  <span>{projectTasks.length} tasks</span>
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
                  <p className="eyebrow">Tasks</p>
                  <h2>Project tasks</h2>
                </div>
                <span>{projectTasks.length} tasks</span>
              </div>
              <div className="task-table">
                <div className="task-row task-header">
                  <span>Task</span>
                  <span>Assignee</span>
                  <span>Priority</span>
                  <span>Status</span>
                  <span>Due</span>
                </div>
                {projectTasks.map((task) => (
                  <article className="task-row" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <small>{task.description || "No description"}</small>
                    </div>
                    <span>{members.find((member) => member.user_id === task.assignee_id)?.name ?? "Unassigned"}</span>
                    <span>{task.priority}</span>
                    <span className="status-pill">{task.status}</span>
                    <span>{task.due_date ?? "No due date"}</span>
                  </article>
                ))}
                {projectTasks.length === 0 ? <p className="empty-state">No tasks in this project yet.</p> : null}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
