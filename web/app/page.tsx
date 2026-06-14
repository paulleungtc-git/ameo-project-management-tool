"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  apiBlob,
  apiRequest,
  isAuthError,
  statusOrder,
  themeKey,
  tokenKey,
  type ActivityEvent,
  type Attachment,
  type Comment,
  type Notification,
  type Project,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type User,
  type Workspace,
  type WorkspaceMember
} from "./lib/api";
import { notifyAuthChanged } from "./lib/auth";
import { Sidebar } from "./components/sidebar";
const attachmentMaxBytes = 10 * 1024 * 1024;
const allowedAttachmentTypes = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/zip"
];
const attachmentAccept = allowedAttachmentTypes.join(",");

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [projectName, setProjectName] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [message, setMessage] = useState("");

  // UI/UX state enhancements
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"details" | "attachments" | "activity">("details");
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const workspace = workspaces[0] ?? null;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  const counts = useMemo(
    () =>
      statusOrder.map((status) => ({
        status,
        count: tasks.filter((task) => task.status === status).length
      })),
    [tasks]
  );

  const buildTaskQuery = useCallback((workspaceId: number) => {
    const params = new URLSearchParams({ workspace_id: String(workspaceId) });
    if (searchText.trim()) {
      params.set("q", searchText.trim());
    }
    if (projectFilter) {
      params.set("project_id", projectFilter);
    }
    if (statusFilter) {
      params.set("status", statusFilter);
    }
    if (priorityFilter) {
      params.set("priority", priorityFilter);
    }
    if (assigneeFilter.trim()) {
      params.set("assignee_id", assigneeFilter.trim());
    }
    if (dueFrom) {
      params.set("due_from", dueFrom);
    }
    if (dueTo) {
      params.set("due_to", dueTo);
    }
    return params;
  }, [assigneeFilter, dueFrom, dueTo, priorityFilter, projectFilter, searchText, statusFilter]);

  const loadWorkspaceData = useCallback(async (nextToken: string, applyFilters = false) => {
    const workspaceData = await apiRequest<Workspace[]>("/workspaces", nextToken);
    setWorkspaces(workspaceData);
    if (workspaceData.length === 0) {
      setProjects([]);
      setTasks([]);
      setMembers([]);
      setNotifications([]);
      setSelectedTaskId(null);
      return;
    }
    const workspaceId = workspaceData[0].id;
    const projectParams = new URLSearchParams({ workspace_id: String(workspaceId) });
    if (applyFilters && searchText.trim()) {
      projectParams.set("q", searchText.trim());
    }
    const taskParams = applyFilters
      ? buildTaskQuery(workspaceId)
      : new URLSearchParams({ workspace_id: String(workspaceId) });
    const [projectData, taskData, memberData, notificationData] = await Promise.all([
      apiRequest<Project[]>(`/projects?${projectParams.toString()}`, nextToken),
      apiRequest<Task[]>(`/tasks?${taskParams.toString()}`, nextToken),
      apiRequest<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`, nextToken),
      apiRequest<Notification[]>(`/notifications?workspace_id=${workspaceId}&unread_only=true`, nextToken)
    ]);
    setProjects(projectData);
    setTasks(taskData);
    setMembers(memberData);
    setNotifications(notificationData);
    setSelectedTaskId((current) =>
      current && taskData.some((task) => task.id === current) ? current : taskData[0]?.id ?? null
    );
  }, [buildTaskQuery, searchText]);

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
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (isAuthError(error)) {
          window.localStorage.removeItem(tokenKey);
          setToken(null);
          notifyAuthChanged();
          return;
        }
        // Transient error (network blip, backend restarting): keep the
        // session and let the user retry instead of logging them out.
        setUser(null);
        setMessage("Couldn't reach the server. It may be restarting - refresh in a moment.");
      });

    return () => {
      cancelled = true;
    };
  }, [loadWorkspaceData, token, user]);

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

  function clearSession() {
    window.localStorage.removeItem(tokenKey);
    setToken(null);
    setUser(null);
    setWorkspaces([]);
    setProjects([]);
    setTasks([]);
    setMembers([]);
    setNotifications([]);
    setSelectedTaskId(null);
    notifyAuthChanged();
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
    setIsProjectModalOpen(false);
  }

  async function reloadNotifications(nextToken = token) {
    if (!nextToken || !workspace) {
      return;
    }
    const notificationData = await apiRequest<Notification[]>(
      `/notifications?workspace_id=${workspace.id}&unread_only=true`,
      nextToken
    );
    setNotifications(notificationData);
  }

  async function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    await loadWorkspaceData(token, true);
  }

  async function handleClearFilters() {
    if (!token) {
      return;
    }
    setSearchText("");
    setProjectFilter("");
    setStatusFilter("");
    setPriorityFilter("");
    setAssigneeFilter("");
    setDueFrom("");
    setDueTo("");
    const workspaceId = workspace?.id;
    if (!workspaceId) {
      return;
    }
    const [projectData, taskData] = await Promise.all([
      apiRequest<Project[]>(`/projects?workspace_id=${workspaceId}`, token),
      apiRequest<Task[]>(`/tasks?workspace_id=${workspaceId}`, token)
    ]);
    setProjects(projectData);
    setTasks(taskData);
    setSelectedTaskId(taskData[0]?.id ?? null);
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || projects.length === 0) {
      return;
    }
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const projectId = Number(data.get("project_id") || projects[0].id);
    const assigneeId = data.get("assignee_id") ? Number(data.get("assignee_id")) : null;
    const priority = String(data.get("priority") ?? "Medium") as TaskPriority;
    
    if (!title) return;

    const task = await apiRequest<Task>("/tasks", token, {
      method: "POST",
      body: JSON.stringify({
        project_id: projectId,
        title,
        status: "Todo",
        priority,
        assignee_id: assigneeId
      })
    });
    setTasks((current) => [task, ...current]);
    setSelectedTaskId(task.id);
    setIsTaskDrawerOpen(true);
    setIsTaskModalOpen(false);
  }

  async function handleUpdateSelectedTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedTask) {
      return;
    }
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) {
      return;
    }
    const description = String(data.get("description") ?? "");
    const status = String(data.get("status") ?? "Todo") as TaskStatus;
    const priority = String(data.get("priority") ?? "Medium") as TaskPriority;
    const assigneeId = String(data.get("assignee_id") ?? "");
    const dueDate = String(data.get("due_date") ?? "");
    const updated = await apiRequest<Task>(`/tasks/${selectedTask.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({
        title,
        description,
        status,
        priority,
        assignee_id: assigneeId ? Number(assigneeId) : null,
        due_date: dueDate || null
      })
    });
    setTasks((current) => current.map((task) => (task.id === updated.id ? updated : task)));
    setMessage("Task updated.");
    await loadTaskDetails(updated.id, token);
    await reloadNotifications(token);
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
    await reloadNotifications(token);
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
    await reloadNotifications(token);
  }

  async function handleMarkNotificationRead(notification: Notification) {
    if (!token) {
      return;
    }
    await apiRequest<Notification>(`/notifications/${notification.id}/read`, token, {
      method: "PATCH"
    });
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
  }

  async function handleUploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedTask || !file) {
      return;
    }
    setAttachmentMessage("");
    if (file.size === 0) {
      setAttachmentMessage("Attachment cannot be empty.");
      return;
    }
    if (file.size > attachmentMaxBytes) {
      setAttachmentMessage(`Attachment must be ${formatBytes(attachmentMaxBytes)} or smaller.`);
      return;
    }
    if (!allowedAttachmentTypes.includes(file.type)) {
      setAttachmentMessage("This file type is not allowed.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setIsUploading(true);
    try {
      const attachment = await apiRequest<Attachment>(`/attachments/tasks/${selectedTask.id}`, token, {
        method: "POST",
        body: formData
      });
      setAttachments((current) => [attachment, ...current]);
      setFile(null);
      setAttachmentMessage("Attachment uploaded.");
      event.currentTarget.reset();
    } catch (error) {
      setAttachmentMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownloadAttachment(attachment: Attachment) {
    if (!token) {
      return;
    }
    try {
      const blob = await apiBlob(`/attachments/${attachment.id}/download`, token);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setAttachmentMessage(error instanceof Error ? error.message : "Download failed.");
    }
  }

  async function handleDeleteAttachment(attachment: Attachment) {
    if (!token) {
      return;
    }
    try {
      await apiRequest<unknown>(`/attachments/${attachment.id}`, token, {
        method: "DELETE"
      });
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      setAttachmentMessage("Attachment deleted.");
    } catch (error) {
      setAttachmentMessage(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    if (!nextFile) {
      setAttachmentMessage("");
      return;
    }
    if (nextFile.size > attachmentMaxBytes) {
      setAttachmentMessage(`Attachment must be ${formatBytes(attachmentMaxBytes)} or smaller.`);
      return;
    }
    if (nextFile.type && !allowedAttachmentTypes.includes(nextFile.type)) {
      setAttachmentMessage("This file type is not allowed.");
      return;
    }
    setAttachmentMessage(`${nextFile.name} selected, ${formatBytes(nextFile.size)}.`);
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <Sidebar active="dashboard" workspace={workspace} userName={user?.name} />

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Live workspace</p>
            <h1>Project dashboard</h1>
          </div>
          <div className="button-row">
            <button type="button" onClick={() => setIsTaskModalOpen(true)} disabled={projects.length === 0}>
              ＋ New Task
            </button>
            <button className="secondary-button" type="button" onClick={() => setIsProjectModalOpen(true)} disabled={!token}>
              ＋ New Project
            </button>
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

        {message ? <p className="form-message">{message}</p> : null}

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
            <span>Unread notifications</span>
            <strong>{notifications.length}</strong>
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

          <section className="panel" id="projects">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Projects</p>
                <h2>Active work</h2>
              </div>
            </div>
            <div className="project-list">
              {projects.map((project) => (
                <Link className="project-item" href={`/projects/${project.id}`} key={project.id}>
                  <div>
                    <h3>{project.name}</h3>
                    <p>{project.description || "No description"}</p>
                  </div>
                  <span className="health">Active</span>
                </Link>
              ))}
              {projects.length === 0 ? <p className="empty-state">No projects yet.</p> : null}
            </div>
          </section>
        </section>

        <section className="panel" id="tasks">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Workspace tasks</p>
              <h2>Tasks</h2>
            </div>
            <div className="button-row" style={{ alignItems: "center" }}>
              <div className="view-tabs">
                <button
                  type="button"
                  className={`view-tab ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                >
                  List View
                </button>
                <button
                  type="button"
                  className={`view-tab ${viewMode === "board" ? "active" : ""}`}
                  onClick={() => setViewMode("board")}
                >
                  Board View
                </button>
              </div>
              <span>{tasks.length} shown</span>
            </div>
          </div>
          <form className="filter-bar" onSubmit={handleApplyFilters}>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search tasks and projects"
              disabled={!token}
            />
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} disabled={!token}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} disabled={!token}>
              <option value="">Any status</option>
              {statusOrder.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              disabled={!token}
            >
              <option value="">Any priority</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
            <select
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              disabled={!token}
            >
              <option value="">Any assignee</option>
              {members.map((member) => (
                <option key={member.id} value={member.user_id}>
                  {member.name}
                </option>
              ))}
            </select>
            <input value={dueFrom} onChange={(event) => setDueFrom(event.target.value)} type="date" disabled={!token} />
            <input value={dueTo} onChange={(event) => setDueTo(event.target.value)} type="date" disabled={!token} />
            <div className="button-row filter-actions">
              <button type="submit" disabled={!token}>
                Apply
              </button>
              <button className="secondary-button" type="button" onClick={handleClearFilters} disabled={!token}>
                Clear
              </button>
            </div>
          </form>

          {viewMode === "list" ? (
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
                  <button className="task-link" type="button" onClick={() => { setSelectedTaskId(task.id); setIsTaskDrawerOpen(true); }}>
                    <strong>{task.title}</strong>
                    <small>{task.description || "No description"}</small>
                  </button>
                  <Link className="member-profile-link" href={`/projects/${task.project_id}`}>
                    {projects.find((project) => project.id === task.project_id)?.name ?? "Project"}
                  </Link>
                  <span style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                    <span className="priority-tag" data-priority={task.priority}>{task.priority}</span>
                    <small>{members.find((member) => member.user_id === task.assignee_id)?.name ?? "Unassigned"}</small>
                  </span>
                  <span className="status-pill" data-status={task.status}>{task.status}</span>
                  <button className="secondary-button compact-button" type="button" onClick={() => advanceTask(task)}>
                    Next
                  </button>
                </article>
              ))}
              {tasks.length === 0 ? <p className="empty-state">No matching tasks.</p> : null}
            </div>
          ) : (
            <div className="kanban-board">
              {statusOrder.map((status) => {
                const columnTasks = tasks.filter((t) => t.status === status);
                return (
                  <div className="kanban-column" key={status}>
                    <div className="kanban-column-header">
                      <h3>{status}</h3>
                      <span className="kanban-column-count">{columnTasks.length}</span>
                    </div>
                    {columnTasks.map((task) => (
                      <div
                        className="kanban-card"
                        key={task.id}
                        onClick={() => { setSelectedTaskId(task.id); setIsTaskDrawerOpen(true); }}
                      >
                        <div className="kanban-card-title">{task.title}</div>
                        <div className="kanban-card-meta">
                          <div className="kanban-card-tags">
                            <span className="priority-tag" data-priority={task.priority}>
                              {task.priority}
                            </span>
                          </div>
                          <span style={{ opacity: 0.85 }}>
                            {members.find((m) => m.user_id === task.assignee_id)?.name?.split(" ")[0] ?? "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {columnTasks.length === 0 ? (
                      <p className="empty-state" style={{ padding: "1.5rem 0.5rem", fontSize: "0.8rem" }}>
                        No tasks
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Notifications</p>
              <h2>Inbox</h2>
            </div>
            <span>{notifications.length} unread</span>
          </div>
          <div className="detail-list">
            {notifications.map((notification) => (
              <article className="detail-item notification-item" key={notification.id}>
                <div>
                  <strong>{notification.title}</strong>
                  <small>{notification.body}</small>
                </div>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={() => handleMarkNotificationRead(notification)}
                >
                  Mark read
                </button>
              </article>
            ))}
            {notifications.length === 0 ? <p className="empty-state">No unread notifications.</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Members</p>
              <h2>Workspace access</h2>
            </div>
            <span>{members.length} members</span>
          </div>
          <div className="button-row" style={{ marginBottom: "1rem" }}>
            <Link className="button-link" href="/members">
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

        {/* Task Details Drawer Backdrop */}
        <div
          className={`drawer-backdrop ${isTaskDrawerOpen && selectedTask ? "active" : ""}`}
          onClick={() => setIsTaskDrawerOpen(false)}
        />

        {/* Task Details Drawer */}
        <aside className={`drawer ${isTaskDrawerOpen && selectedTask ? "open" : ""}`}>
          <div className="drawer-header">
            <div>
              <p className="eyebrow">Task details</p>
              <h2>{selectedTask?.title || "No task selected"}</h2>
            </div>
            <button className="drawer-close" type="button" onClick={() => setIsTaskDrawerOpen(false)}>
              &times;
            </button>
          </div>
          <div className="drawer-tabs">
            <button
              type="button"
              className={`drawer-tab ${drawerTab === "details" ? "active" : ""}`}
              onClick={() => setDrawerTab("details")}
            >
              Details
            </button>
            <button
              type="button"
              className={`drawer-tab ${drawerTab === "attachments" ? "active" : ""}`}
              onClick={() => setDrawerTab("attachments")}
            >
              Attachments ({attachments.length})
            </button>
            <button
              type="button"
              className={`drawer-tab ${drawerTab === "activity" ? "active" : ""}`}
              onClick={() => setDrawerTab("activity")}
            >
              Activity
            </button>
          </div>

          <div className="drawer-body">
            {selectedTask && drawerTab === "details" && (
              <>
                <form className="task-edit-form" key={selectedTask.id} onSubmit={handleUpdateSelectedTask}>
                  <input
                    name="title"
                    defaultValue={selectedTask.title}
                    placeholder="Task title"
                  />
                  <textarea
                    name="description"
                    defaultValue={selectedTask.description ?? ""}
                    placeholder="Description"
                  />
                  <select name="status" defaultValue={selectedTask.status}>
                    {statusOrder.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <select name="priority" defaultValue={selectedTask.priority}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                  <select name="assignee_id" defaultValue={selectedTask.assignee_id ?? ""}>
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.user_id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <input name="due_date" defaultValue={selectedTask.due_date ?? ""} type="date" />
                  <button type="submit" style={{ gridColumn: "1 / -1" }}>
                    Save changes
                  </button>
                </form>

                <hr style={{ border: 0, borderBottom: "1px solid var(--line)", margin: "1.5rem 0" }} />

                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <h3>Comments</h3>
                  <form className="form-panel" onSubmit={handleCreateComment}>
                    <input
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      placeholder="Add a comment"
                    />
                    <button type="submit" disabled={!commentBody.trim()}>
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
                    {comments.length === 0 ? <p className="empty-state">No comments yet.</p> : null}
                  </div>
                </div>
              </>
            )}

            {selectedTask && drawerTab === "attachments" && (
              <div style={{ display: "grid", gap: "1rem" }}>
                <h3>Attachments</h3>
                <form className="form-panel" onSubmit={handleUploadAttachment}>
                  <input type="file" accept={attachmentAccept} onChange={handleFileChange} disabled={isUploading} />
                  <button type="submit" disabled={!file || isUploading}>
                    {isUploading ? "Uploading..." : "Upload file"}
                  </button>
                  {attachmentMessage ? <p className="form-message">{attachmentMessage}</p> : null}
                </form>
                <div className="detail-list">
                  {attachments.map((attachment) => (
                    <article className="detail-item" key={attachment.id}>
                      <div>
                        <strong>{attachment.filename}</strong>
                        <small>{attachment.content_type} - {formatBytes(attachment.byte_size)}</small>
                      </div>
                      <div className="button-row">
                        <button
                          className="secondary-button compact-button"
                          type="button"
                          onClick={() => handleDownloadAttachment(attachment)}
                        >
                          Download
                        </button>
                        <button
                          className="secondary-button compact-button"
                          type="button"
                          onClick={() => handleDeleteAttachment(attachment)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                  {attachments.length === 0 ? <p className="empty-state">No attachments yet.</p> : null}
                </div>
              </div>
            )}

            {selectedTask && drawerTab === "activity" && (
              <div style={{ display: "grid", gap: "1rem" }}>
                <h3>Activity Log</h3>
                <div className="detail-list">
                  {activity.map((event) => (
                    <article className="detail-item" key={event.id}>
                      <strong>{event.event_type}</strong>
                      <small>{new Date(event.created_at).toLocaleString()}</small>
                    </article>
                  ))}
                  {activity.length === 0 ? <p className="empty-state">No activity yet.</p> : null}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Create Task Modal Overlay */}
        <div className={`modal-overlay ${isTaskModalOpen ? "active" : ""}`} onClick={() => setIsTaskModalOpen(false)}>
          <div className="modal-container" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Create new task</h2>
              <button className="drawer-close" type="button" onClick={() => setIsTaskModalOpen(false)}>
                &times;
              </button>
            </div>
            <form className="form-panel" onSubmit={handleCreateTask}>
              <input name="title" placeholder="Task title" required />
              <textarea name="description" placeholder="Description" />
              <select name="project_id" defaultValue="">
                <option value="" disabled>Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select name="priority" defaultValue="Medium">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <select name="assignee_id" defaultValue="">
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.user_id}>{m.name}</option>
                ))}
              </select>
              <button type="submit">Create task</button>
            </form>
          </div>
        </div>

        {/* Create Project Modal Overlay */}
        <div className={`modal-overlay ${isProjectModalOpen ? "active" : ""}`} onClick={() => setIsProjectModalOpen(false)}>
          <div className="modal-container" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Create new project</h2>
              <button className="drawer-close" type="button" onClick={() => setIsProjectModalOpen(false)}>
                &times;
              </button>
            </div>
            <form className="form-panel" onSubmit={handleCreateProject}>
              <input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Project name"
                required
              />
              <button type="submit">Create project</button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

