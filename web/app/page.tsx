type TaskStatus = "Backlog" | "Todo" | "In Progress" | "Review" | "Done";

type Task = {
  id: number;
  title: string;
  project: string;
  owner: string;
  due: string;
  priority: "Low" | "Medium" | "High";
  status: TaskStatus;
};

const statusOrder: TaskStatus[] = [
  "Backlog",
  "Todo",
  "In Progress",
  "Review",
  "Done"
];

const tasks: Task[] = [
  {
    id: 1,
    title: "Map workspace onboarding flow",
    project: "Product Launch",
    owner: "Maya",
    due: "May 14",
    priority: "High",
    status: "In Progress"
  },
  {
    id: 2,
    title: "Draft task detail activity model",
    project: "Core PM",
    owner: "Evan",
    due: "May 16",
    priority: "Medium",
    status: "Review"
  },
  {
    id: 3,
    title: "Prepare customer interview notes",
    project: "Discovery",
    owner: "Nora",
    due: "May 18",
    priority: "Medium",
    status: "Todo"
  },
  {
    id: 4,
    title: "Define fixed workflow states",
    project: "Core PM",
    owner: "Maya",
    due: "May 10",
    priority: "High",
    status: "Done"
  }
];

const projects = [
  {
    name: "Product Launch",
    owner: "Maya",
    health: "On track",
    progress: 64
  },
  {
    name: "Core PM",
    owner: "Evan",
    health: "Needs review",
    progress: 48
  },
  {
    name: "Discovery",
    owner: "Nora",
    health: "On track",
    progress: 72
  }
];

const counts = statusOrder.map((status) => ({
  status,
  count: tasks.filter((task) => task.status === status).length
}));

export default function Home() {
  return (
    <main className="app-shell">
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
          <a href="#">Reports</a>
        </nav>
        <div className="workspace-card">
          <span>Current workspace</span>
          <strong>Ameo Studio</strong>
          <p>8 members, 3 active projects</p>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Today</p>
            <h1>Project dashboard</h1>
          </div>
          <button type="button">New task</button>
        </header>

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
            <span>Due this week</span>
            <strong>5</strong>
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
              <span>Updated now</span>
            </div>
            <div className="project-list">
              {projects.map((project) => (
                <article className="project-item" key={project.name}>
                  <div>
                    <h3>{project.name}</h3>
                    <p>{project.owner} owns delivery</p>
                  </div>
                  <span className="health">{project.health}</span>
                  <div className="progress" aria-label={`${project.progress}% complete`}>
                    <span style={{ width: `${project.progress}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Priority queue</p>
              <h2>Upcoming tasks</h2>
            </div>
            <span>Next 7 days</span>
          </div>
          <div className="task-table">
            <div className="task-row task-header">
              <span>Task</span>
              <span>Project</span>
              <span>Owner</span>
              <span>Due</span>
              <span>Status</span>
            </div>
            {tasks.map((task) => (
              <article className="task-row" key={task.id}>
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.priority} priority</small>
                </span>
                <span>{task.project}</span>
                <span>{task.owner}</span>
                <span>{task.due}</span>
                <span className="status-pill">{task.status}</span>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
