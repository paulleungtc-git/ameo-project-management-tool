"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type TaskStatus = "Backlog" | "Todo" | "In Progress" | "Review" | "Done";
type TaskPriority = "Low" | "Medium" | "High";

type User = {
  id: number;
  email: string;
  name: string;
};

type Workspace = {
  id: number;
  name: string;
  role: string;
};

type Project = {
  id: number;
  workspace_id: number;
  name: string;
  description: string;
};

type Task = {
  id: number;
  workspace_id: number;
  project_id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
};

type Comment = {
  id: number;
  task_id: number;
  author_id: number;
  body: string;
  created_at: string;
};

type ActivityEvent = {
  id: number;
  task_id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type Attachment = {
  id: number;
  filename: string;
  content_type: string;
  byte_size: number;
  checksum: string;
  created_at: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const tokenKey = "ameo_token";
const themeKey = "ameo_theme";
const statusOrder: TaskStatus[] = ["Backlog", "Todo", "In Progress", "Review", "Done"];

async function apiRequest<T>(
  path: string,
  token: string | null,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export default function Home() {
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
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [email, setEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("password123");
  const [name, setName] = useState("Owner");
  const [workspaceName, setWorkspaceName] = useState("Ameo Studio");
  const [projectName, setProjectName] = useState("Launch");
  const [taskTitle, setTaskTitle] = useState("Create first real task");
  const [commentBody, setCommentBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  const workspace = workspaces[0] ?? null;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? null;

  const counts = useMemo(
    () =>
      statusOrder.map((status) => ({
        status,
        count: tasks.filter((task) => task.status === status).length
      })),
    [tasks]
  );

  useEffect(() => {
    if (!token || user) {
      return;
    }

    let cancelled = false;
    apiRequest<User>("/auth/me", token)
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser);
          return loadWorkspaceData(token);
        }
      })
      .catch(() => {
        if (!cancelled) {
          window.localStorage.removeItem(tokenKey);
          setToken(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, user]);

  useEffect(() => {
    window.localStorage.setItem(themeKey, theme);
  }, [theme]);

  useEffect(() => {
    if (!selectedTaskId || !token) {
      return;
    }

    let cancelled = false;
    Promise.all([
      apiRequest<Comment[]>(`/tasks/${selectedTaskId}/comments`, token),
      apiRequest<ActivityEvent[]>(`/tasks/${selectedTaskId}/activity`, token),
      apiRequest<Attachment[]>(`/attachments/tasks/${selectedTaskId}`, token)
    ]).then(([commentData, activityData, attachmentData]) => {
      if (!cancelled) {
        setComments(commentData);
        setActivity(activityData);
        setAttachments(attachmentData);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedTaskId, token]);

  async function loadWorkspaceData(nextToken: string) {
    const workspaceData = await apiRequest<Workspace[]>("/workspaces", nextToken);
    setWorkspaces(workspaceData);
    if (workspaceData.length === 0) {
      setProjects([]);
      setTasks([]);
      setSelectedTaskId(null);
      return;
    }
    const workspaceId = workspaceData[0].id;
    const [projectData, taskData] = await Promise.all([
      apiRequest<Project[]>(`/projects?workspace_id=${workspaceId}`, nextToken),
      apiRequest<Task[]>(`/tasks?workspace_id=${workspaceId}`, nextToken)
    ]);
    setProjects(projectData);
    setTasks(taskData);
    setSelectedTaskId((current) => current ?? taskData[0]?.id ?? null);
  }

  async function loadTaskDetails(taskId: number, nextToken = token) {
    if (!nextToken) {
      return;
    }
    const [commentData, activityData, attachmentData] = await Promise.all([
      apiRequest<Comment[]>(`/tasks/${taskId}/comments`, nextToken),
      apiRequest<ActivityEvent[]>(`/tasks/${taskId}/activity`, nextToken),
      apiRequest<Attachment[]>(`/attachments/tasks/${taskId}`, nextToken)
    ]);
    setComments(commentData);
    setActivity(activityData);
    setAttachments(attachmentData);
  }

  function saveSession(nextToken: string, nextUser: User) {
    window.localStorage.setItem(tokenKey, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }

  function clearSession() {
    window.localStorage.removeItem(tokenKey);
    setToken(null);
    setUser(null);
    setWorkspaces([]);
    setProjects([]);
    setTasks([]);
    setSelectedTaskId(null);
    setMessage("Signed out.");
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      const response = await apiRequest<{ access_token: string; user: User }>("/auth/register", null, {
        method: "POST",
        body: JSON.stringify({
          email,
          name,
          password,
          workspace_name: workspaceName
        })
      });
      saveSession(response.access_token, response.user);
      await loadWorkspaceData(response.access_token);
      setMessage("Workspace created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed.");
    }
  }

  async function handleLogin(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setMessage("");
    try {
      const response = await apiRequest<{ access_token: string; user: User }>("/auth/login", null, {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      saveSession(response.access_token, response.user);
      await loadWorkspaceData(response.access_token);
      setMessage("Signed in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    }
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !workspace) {
      return;
    }
    const project = await apiRequest<Project>("/projects", token, {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspace.id,
        name: projectName,
        description: ""
      })
    });
    setProjects((current) => [project, ...current]);
    setProjectName("");
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || projects.length === 0) {
      return;
    }
    const task = await apiRequest<Task>("/tasks", token, {
      method: "POST",
      body: JSON.stringify({
        project_id: projects[0].id,
        title: taskTitle,
        status: "Todo",
        priority: "Medium"
      })
    });
    setTasks((current) => [task, ...current]);
    setSelectedTaskId(task.id);
    setTaskTitle("");
  }

  async function advanceTask(task: Task) {
    if (!token) {
      return;
    }
    const currentIndex = statusOrder.indexOf(task.status);
    const nextStatus = statusOrder[Math.min(currentIndex + 1, statusOrder.length - 1)];
    const updated = await apiRequest<Task>(`/tasks/${task.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus })
    });
    setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    if (selectedTaskId === updated.id) {
      await loadTaskDetails(updated.id, token);
    }
  }

  async function handleCreateComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedTask || !commentBody.trim()) {
      return;
    }
    const comment = await apiRequest<Comment>(`/tasks/${selectedTask.id}/comments`, token, {
      method: "POST",
      body: JSON.stringify({ body: commentBody })
    });
    setComments((current) => [...current, comment]);
    setCommentBody("");
    await loadTaskDetails(selectedTask.id, token);
  }

  async function handleUploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedTask || !file) {
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    const attachment = await apiRequest<Attachment>(`/attachments/tasks/${selectedTask.id}`, token, {
      method: "POST",
      body: formData
    });
    setAttachments((current) => [attachment, ...current]);
    setFile(null);
    event.currentTarget.reset();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
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
          <a className="active" href="#">
            Dashboard
          </a>
          <a href="#">Projects</a>
          <a href="#">Tasks</a>
          <a href="#">Members</a>
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
            <p className="eyebrow">Live workspace</p>
            <h1>Project dashboard</h1>
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

        <section className="setup-grid">
          <form className="panel form-panel" onSubmit={handleRegister}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Account</p>
                <h2>Create workspace</h2>
              </div>
            </div>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
            />
            <input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Workspace"
            />
            <div className="button-row">
              <button type="submit">Register</button>
              <button className="secondary-button" type="button" onClick={() => handleLogin()}>
                Login
              </button>
            </div>
            {message ? <p className="form-message">{message}</p> : null}
          </form>

          <form className="panel form-panel" onSubmit={handleCreateProject}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Projects</p>
                <h2>Add project</h2>
              </div>
            </div>
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Project name"
              disabled={!token}
            />
            <button type="submit" disabled={!token || !workspace}>
              Create project
            </button>
          </form>

          <form className="panel form-panel" onSubmit={handleCreateTask}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Tasks</p>
                <h2>Add task</h2>
              </div>
            </div>
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="Task title"
              disabled={projects.length === 0}
            />
            <button type="submit" disabled={projects.length === 0}>
              Create task
            </button>
          </form>
        </section>

        <section className="metrics" aria-label="Workspace summary">
          <article>
            <span>Open tasks</span>
            <strong>{tasks.filter((task) => task.status !== "Done").length}</strong>
          </article>
          <article>
            <span>Active projects</span>
            <strong>{projects.length}</strong>
          </article>
          <article>
            <span>In review</span>
            <strong>{counts.find((item) => item.status === "Review")?.count}</strong>
          </article>
          <article>
            <span>Total tasks</span>
            <strong>{tasks.length}</strong>
          </article>
        </section>

        <section className="main-grid">
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

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Projects</p>
                <h2>Active work</h2>
              </div>
            </div>
            <div className="project-list">
              {projects.map((project) => (
                <article className="project-item" key={project.id}>
                  <div>
                    <h3>{project.name}</h3>
                    <p>{project.description || "No description"}</p>
                  </div>
                  <span className="health">Active</span>
                </article>
              ))}
              {projects.length === 0 ? <p className="empty-state">No projects yet.</p> : null}
            </div>
          </section>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Priority queue</p>
              <h2>Tasks</h2>
            </div>
          </div>
          <div className="task-table">
            <div className="task-row task-header">
              <span>Task</span>
              <span>Project</span>
              <span>Priority</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {tasks.map((task) => (
              <article className="task-row" key={task.id}>
                <button className="task-link" type="button" onClick={() => setSelectedTaskId(task.id)}>
                  <strong>{task.title}</strong>
                  <small>{task.description || "No description"}</small>
                </button>
                <span>{projects.find((project) => project.id === task.project_id)?.name ?? "Project"}</span>
                <span>{task.priority}</span>
                <span className="status-pill">{task.status}</span>
                <button className="secondary-button compact-button" type="button" onClick={() => advanceTask(task)}>
                  Next
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Selected task</p>
                <h2>{selectedTask?.title ?? "No task selected"}</h2>
              </div>
            </div>
            <form className="form-panel" onSubmit={handleCreateComment}>
              <input
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="Add a comment"
                disabled={!selectedTask}
              />
              <button type="submit" disabled={!selectedTask || !commentBody.trim()}>
                Comment
              </button>
            </form>
            <div className="detail-list">
              {comments.map((comment) => (
                <article className="detail-item" key={comment.id}>
                  <strong>{comment.body}</strong>
                  <small>{new Date(comment.created_at).toLocaleString()}</small>
                </article>
              ))}
              {selectedTask && comments.length === 0 ? <p className="empty-state">No comments yet.</p> : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Files</p>
                <h2>Attachments</h2>
              </div>
            </div>
            <form className="form-panel" onSubmit={handleUploadAttachment}>
              <input type="file" onChange={handleFileChange} disabled={!selectedTask} />
              <button type="submit" disabled={!selectedTask || !file}>
                Upload file
              </button>
            </form>
            <div className="detail-list">
              {attachments.map((attachment) => (
                <article className="detail-item" key={attachment.id}>
                  <strong>{attachment.filename}</strong>
                  <small>{attachment.content_type} - {attachment.byte_size} bytes</small>
                </article>
              ))}
              {selectedTask && attachments.length === 0 ? <p className="empty-state">No attachments yet.</p> : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">History</p>
                <h2>Activity</h2>
              </div>
            </div>
            <div className="detail-list">
              {activity.map((event) => (
                <article className="detail-item" key={event.id}>
                  <strong>{event.event_type}</strong>
                  <small>{new Date(event.created_at).toLocaleString()}</small>
                </article>
              ))}
              {selectedTask && activity.length === 0 ? <p className="empty-state">No activity yet.</p> : null}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
