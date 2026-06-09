"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest, themeKey, tokenKey, type Project, type Task, type User, type Workspace } from "../lib/api";

function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

type WorkspaceResources = {
  projects: Project[];
  tasks: Task[];
};

export default function ProjectsPage() {
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
  const [searchText, setSearchText] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("all");
  const [createWorkspaceId, setCreateWorkspaceId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return Boolean(window.localStorage.getItem(tokenKey));
  });
  const [isCreating, setIsCreating] = useState(false);

  const currentWorkspace = workspaces[0] ?? null;
  const workspaceById = useMemo(() => new Map(workspaces.map((workspace) => [workspace.id, workspace])), [workspaces]);
  const taskStatsByProjectId = useMemo(() => {
    const stats = new Map<number, { total: number; open: number; review: number; done: number }>();
    for (const project of projects) {
      stats.set(project.id, { total: 0, open: 0, review: 0, done: 0 });
    }
    for (const task of tasks) {
      const existing = stats.get(task.project_id) ?? { total: 0, open: 0, review: 0, done: 0 };
      existing.total += 1;
      if (task.status === "Done") {
        existing.done += 1;
      } else {
        existing.open += 1;
      }
      if (task.status === "Review") {
        existing.review += 1;
      }
      stats.set(task.project_id, existing);
    }
    return stats;
  }, [projects, tasks]);

  const filteredProjects = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return projects.filter((project) => {
      const workspace = workspaceById.get(project.workspace_id);
      const matchesWorkspace = workspaceFilter === "all" || String(project.workspace_id) === workspaceFilter;
      const matchesSearch =
        query.length === 0 ||
        project.name.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query) ||
        workspace?.name.toLowerCase().includes(query);
      return matchesWorkspace && matchesSearch;
    });
  }, [projects, searchText, workspaceById, workspaceFilter]);

  const summary = useMemo(
    () => ({
      activeWorkspaces: new Set(projects.map((project) => project.workspace_id)).size,
      openTasks: tasks.filter((task) => task.status !== "Done").length,
      reviewTasks: tasks.filter((task) => task.status === "Review").length,
      totalProjects: projects.length
    }),
    [projects, tasks]
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
        setCreateWorkspaceId((current) => current || String(workspaceData[0]?.id ?? ""));
        if (workspaceData.length === 0) {
          setProjects([]);
          setTasks([]);
          setMessage("");
          setIsLoading(false);
          return null;
        }
        return Promise.all(
          workspaceData.map(async (workspace) => {
            const [projectData, taskData] = await Promise.all([
              apiRequest<Project[]>(`/projects?workspace_id=${workspace.id}`, token),
              apiRequest<Task[]>(`/tasks?workspace_id=${workspace.id}`, token)
            ]);
            return { projects: projectData, tasks: taskData };
          })
        );
      })
      .then((workspaceResources) => {
        if (cancelled || workspaceResources === null) {
          return;
        }
        const resources = workspaceResources as WorkspaceResources[];
        setProjects(resources.flatMap((resource) => resource.projects));
        setTasks(resources.flatMap((resource) => resource.tasks));
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
        setProjects([]);
        setTasks([]);
        setIsLoading(false);
        setMessage(error instanceof Error ? error.message : "Could not load projects.");
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
    setProjects([]);
    setTasks([]);
    setIsLoading(false);
    setMessage("Signed out.");
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !createWorkspaceId || !projectName.trim()) {
      return;
    }
    setMessage("");
    setIsCreating(true);
    try {
      const project = await apiRequest<Project>("/projects", token, {
        method: "POST",
        body: JSON.stringify({
          description: projectDescription.trim(),
          name: projectName.trim(),
          workspace_id: Number(createWorkspaceId)
        })
      });
      setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
      setProjectName("");
      setProjectDescription("");
      setMessage("Project created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create project.");
    } finally {
      setIsCreating(false);
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
          {currentWorkspace ? <Link href={`/workspaces/${currentWorkspace.id}`}>Workspace</Link> : null}
          <Link className="active" href="/projects">
            Projects
          </Link>
          <Link href="/#tasks">Tasks</Link>
          <Link href="/members">Members</Link>
        </nav>
        <div className="workspace-card">
          <span>Current workspace</span>
          <strong>{currentWorkspace?.name ?? "Not signed in"}</strong>
          <p>{user ? `${user.name} - ${currentWorkspace?.role ?? "member"}` : "Create or sign in first"}</p>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Project portfolio</p>
            <h1>Projects</h1>
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
              <h2>Sign in to view projects</h2>
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
            <p className="empty-state">Loading projects...</p>
          </section>
        ) : null}

        {token && !isLoading && workspaces.length === 0 ? (
          <section className="panel empty-panel">
            <div>
              <p className="eyebrow">No workspace</p>
              <h2>No workspace membership found</h2>
              <p className="form-message">Create a workspace from the dashboard before adding projects.</p>
            </div>
            <Link className="button-link" href="/">
              Go to dashboard
            </Link>
          </section>
        ) : null}

        {token && !isLoading && workspaces.length > 0 ? (
          <>
            <section className="metrics" aria-label="Project summary">
              <article>
                <span>Total projects</span>
                <strong>{summary.totalProjects}</strong>
              </article>
              <article>
                <span>Open tasks</span>
                <strong>{summary.openTasks}</strong>
              </article>
              <article>
                <span>In review</span>
                <strong>{summary.reviewTasks}</strong>
              </article>
              <article>
                <span>Workspaces</span>
                <strong>{summary.activeWorkspaces}</strong>
              </article>
            </section>

            <section className="member-management-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Directory</p>
                    <h2>Project list</h2>
                  </div>
                  <span>{filteredProjects.length} shown</span>
                </div>
                <div className="members-toolbar">
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search projects or workspace"
                  />
                  <select value={workspaceFilter} onChange={(event) => setWorkspaceFilter(event.target.value)}>
                    <option value="all">All workspaces</option>
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="project-list">
                  {filteredProjects.map((project) => {
                    const workspace = workspaceById.get(project.workspace_id);
                    const stats = taskStatsByProjectId.get(project.id) ?? { total: 0, open: 0, review: 0, done: 0 };
                    return (
                      <Link className="project-item" href={`/projects/${project.id}`} key={project.id}>
                        <div>
                          <h3>{project.name}</h3>
                          <p>{project.description || "No description"}</p>
                          <p>{workspace ? `${workspace.name} - ${formatRole(workspace.role)}` : "Workspace"}</p>
                        </div>
                        <span className="health">{stats.open} open</span>
                        <div className="progress" aria-label={`${stats.done} of ${stats.total} tasks done`}>
                          <span style={{ width: `${stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100)}%` }} />
                        </div>
                      </Link>
                    );
                  })}
                  {filteredProjects.length === 0 ? <p className="empty-state">No matching projects.</p> : null}
                </div>
              </section>

              <aside className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Project</p>
                    <h2>Add project</h2>
                  </div>
                </div>
                <form className="form-panel" onSubmit={handleCreateProject}>
                  <select
                    value={createWorkspaceId}
                    onChange={(event) => setCreateWorkspaceId(event.target.value)}
                    disabled={isCreating}
                  >
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Project name"
                    disabled={isCreating}
                  />
                  <textarea
                    value={projectDescription}
                    onChange={(event) => setProjectDescription(event.target.value)}
                    placeholder="Description"
                    disabled={isCreating}
                  />
                  <button type="submit" disabled={!projectName.trim() || !createWorkspaceId || isCreating}>
                    {isCreating ? "Creating" : "Create project"}
                  </button>
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
