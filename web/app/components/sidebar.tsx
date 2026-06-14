"use client";

import Link from "next/link";

type SidebarWorkspace = {
  id: number;
  name: string;
  role: string;
};

type SidebarProps = {
  active: "dashboard" | "workspace" | "projects" | "members";
  workspace?: SidebarWorkspace | null;
  userName?: string | null;
};

const buildInfo = process.env.NEXT_PUBLIC_BUILD_INFO ?? "dev";

export function Sidebar({ active, workspace, userName }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Workspace navigation">
      <div className="brand">
        <span className="brand-mark">A</span>
        <div>
          <strong>Ameo</strong>
          <span>Project workspace</span>
        </div>
      </div>
      <nav className="nav-list" aria-label="Primary">
        <Link className={active === "dashboard" ? "active" : undefined} href="/">
          Dashboard
        </Link>
        {workspace ? (
          <Link
            className={active === "workspace" ? "active" : undefined}
            href={`/workspaces/${workspace.id}`}
          >
            Workspace
          </Link>
        ) : null}
        <Link className={active === "projects" ? "active" : undefined} href="/projects">
          Projects
        </Link>
        <Link className={active === "members" ? "active" : undefined} href="/members">
          Members
        </Link>
      </nav>
      {workspace ? (
        <Link className="workspace-card" href={`/workspaces/${workspace.id}`}>
          <span>Current workspace</span>
          <strong>{workspace.name}</strong>
          <p>{userName ? `${userName} - ${workspace.role}` : workspace.role}</p>
        </Link>
      ) : (
        <div className="workspace-card">
          <span>Current workspace</span>
          <strong>Loading</strong>
          <p>Fetching your workspace</p>
        </div>
      )}
      <p className="build-info" title="Last deployed commit">
        {buildInfo}
      </p>
    </aside>
  );
}
