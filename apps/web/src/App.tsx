import { useCallback, useEffect, useState } from "react";
import {
  LogOut,
  Plus,
  Users,
  Copy,
  Check,
  FileText,
  MessageSquare,
  Loader2,
  Archive,
  MoveRight,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { apiClient } from "./lib/apiClient";
import { CollaborativeEditor } from "./components/editor/CollaborativeEditor";
import { useToast } from "./components/ToastProvider";
import { ToastProvider } from "./components/ToastProvider";

type Workspace = {
  id: string;
  name: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  _count: { members: number; pages: number };
};
type Member = {
  id: string;
  role: Workspace["role"];
  user: { id: string; email: string; name: string; avatarUrl: string | null };
};
type PageNode = {
  id: string;
  title: string;
  parentId: string | null;
  effectivePermission: "VIEW" | "COMMENT" | "EDIT";
  children: PageNode[];
};
type PagePermission = {
  userId: string;
  permission: "VIEW" | "COMMENT" | "EDIT";
  user: { name: string; email: string };
};
type CommentItem = {
  id: string;
  authorId: string;
  content: string;
  isResolved: boolean;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
  replies: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: { name: string };
  }>;
};

function flattenPages(pages: PageNode[]): PageNode[] {
  return pages.flatMap((page) => [page, ...flattenPages(page.children)]);
}

function LoadingRows({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-2 py-2" aria-label="Loading" role="status">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="h-8 animate-pulse rounded-md bg-slate-100"
        />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function PageTree({
  pages,
  selectedId,
  onSelect,
  depth = 0,
}: {
  pages: PageNode[];
  selectedId: string;
  onSelect: (page: PageNode) => void;
  depth?: number;
}) {
  return (
    <ul
      className={depth ? "ml-3 border-l border-slate-100 pl-2" : "space-y-0.5"}
    >
      {pages.map((page) => (
        <li key={page.id}>
          <button
            onClick={() => onSelect(page)}
            className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${selectedId === page.id ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <FileText size={14} className="shrink-0" />
            <span className="truncate">{page.title}</span>
          </button>
          {page.children.length > 0 && (
            <PageTree
              pages={page.children}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function WorkspaceShell() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [pages, setPages] = useState<PageNode[]>([]);
  const [pagePermissions, setPagePermissions] = useState<PagePermission[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState("");
  const [selectedPage, setSelectedPage] = useState<PageNode | null>(null);
  const [pageTitle, setPageTitle] = useState("");
  const [permissionTarget, setPermissionTarget] = useState("");
  const [permissionLevel, setPermissionLevel] =
    useState<PagePermission["permission"]>("VIEW");
  const [moveTarget, setMoveTarget] = useState("");
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [acceptToken, setAcceptToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<Set<string>>(
    () => new Set(),
  );
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const active = workspaces.find((workspace) => workspace.id === activeId);

  const runPending = async <T,>(
    key: string,
    action: () => Promise<T>,
  ): Promise<T | undefined> => {
    if (pendingActions.has(key)) return undefined;
    setPendingActions((current) => new Set(current).add(key));
    try {
      return await action();
    } finally {
      setPendingActions((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };
  const isPending = (key: string) => pendingActions.has(key);

  const loadWorkspaces = useCallback(
    async (selectId?: string) => {
      setLoading(true);
      try {
        const rows = await apiClient.get<Workspace[]>("/api/workspaces");
        setWorkspaces(rows);
        setActiveId(
          (current) =>
            selectId ||
            (rows.some((row) => row.id === current)
              ? current
              : rows[0]?.id || ""),
        );
      } catch (reason) {
        toast.error(
          reason instanceof Error
            ? reason.message
            : "Could not load workspaces.",
        );
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);
  useEffect(() => {
    if (!activeId) {
      setMembers([]);
      setMembersLoading(false);
      return;
    }
    let current = true;
    setMembersLoading(true);
    apiClient
      .get<Member[]>(`/api/workspaces/${activeId}/members`)
      .then((rows) => {
        if (current) setMembers(rows);
      })
      .catch(
        (reason) =>
          current &&
          toast.error(
            reason instanceof Error
              ? reason.message
              : "Could not load members.",
          ),
      )
      .finally(() => current && setMembersLoading(false));
    return () => {
      current = false;
    };
  }, [activeId, toast]);
  useEffect(() => {
    setPages([]);
    setSelectedPage(null);
    if (!activeId) {
      setPagesLoading(false);
      return;
    }
    let current = true;
    setPagesLoading(true);
    apiClient
      .get<PageNode[]>(`/api/workspaces/${activeId}/pages`)
      .then((rows) => {
        if (current) setPages(rows);
      })
      .catch(
        (reason) =>
          current &&
          toast.error(
            reason instanceof Error ? reason.message : "Could not load pages.",
          ),
      )
      .finally(() => current && setPagesLoading(false));
    return () => {
      current = false;
    };
  }, [activeId, toast]);
  useEffect(() => {
    const pageId = selectedPage?.id;
    if (!pageId) return;

    let current = true;
    const refreshPermission = async () => {
      try {
        const latest = await apiClient.get<PageNode>(`/api/pages/${pageId}`);
        if (!current) return;
        setSelectedPage((page) =>
          page?.id === pageId &&
          page.effectivePermission !== latest.effectivePermission
            ? { ...page, effectivePermission: latest.effectivePermission }
            : page,
        );
      } catch {
        // Permission polling is best effort; normal page loading reports errors.
      }
    };

    void refreshPermission();
    const timer = window.setInterval(() => void refreshPermission(), 1500);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [selectedPage?.id]);
  useEffect(() => {
    if (
      !selectedPage ||
      !active ||
      (active.role !== "OWNER" && active.role !== "ADMIN")
    ) {
      setPagePermissions([]);
      setPermissionsLoading(false);
      return;
    }
    let current = true;
    setPermissionsLoading(true);
    apiClient
      .get<PagePermission[]>(`/api/pages/${selectedPage.id}/permissions`)
      .then((rows) => {
        if (current) setPagePermissions(rows);
      })
      .catch(
        (reason) =>
          current &&
          toast.error(
            reason instanceof Error
              ? reason.message
              : "Could not load page permissions.",
          ),
      )
      .finally(() => current && setPermissionsLoading(false));
    return () => {
      current = false;
    };
  }, [selectedPage?.id, active?.id, active?.role, active, selectedPage, toast]);
  useEffect(() => {
    setComments([]);
    if (!selectedPage) {
      setCommentsLoading(false);
      return;
    }
    let current = true;
    setCommentsLoading(true);
    apiClient
      .get<CommentItem[]>(`/api/pages/${selectedPage.id}/comments`)
      .then((rows) => {
        if (current) setComments(rows);
      })
      .catch(
        (reason) =>
          current &&
          toast.error(
            reason instanceof Error
              ? reason.message
              : "Could not load comments.",
          ),
      )
      .finally(() => current && setCommentsLoading(false));
    return () => {
      current = false;
    };
  }, [selectedPage?.id, selectedPage, toast]);

  const createPage = async (parentId?: string) => {
    if (!active) return;
    try {
      const created = await apiClient.post<PageNode>(
        `/api/workspaces/${active.id}/pages`,
        { title: "Untitled", parentId },
      );
      const detail = await apiClient.get<PageNode>(`/api/pages/${created.id}`);
      const tree = await apiClient.get<PageNode[]>(
        `/api/workspaces/${active.id}/pages`,
      );
      setPages(tree);
      setSelectedPage(detail);
      setPageTitle(detail.title);
      toast.success("Page created.");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Could not create page.",
      );
    }
  };

  const renamePage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPage) return;
    if (!pageTitle.trim()) {
      toast.error("Page name cannot be empty.");
      return;
    }
    try {
      const updated = await apiClient.patch<PageNode>(
        `/api/pages/${selectedPage.id}`,
        { title: pageTitle },
      );
      setSelectedPage({ ...selectedPage, title: updated.title });
      const tree = await apiClient.get<PageNode[]>(
        `/api/workspaces/${activeId}/pages`,
      );
      setPages(tree);
      toast.success("Page renamed.");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Could not rename page.",
      );
    }
  };

  const movePage = async () => {
    if (!selectedPage) return;
    try {
      await apiClient.post(`/api/pages/${selectedPage.id}/move`, {
        targetParentId: moveTarget || null,
      });
      setPages(
        await apiClient.get<PageNode[]>(`/api/workspaces/${activeId}/pages`),
      );
      setSelectedPage(
        await apiClient.get<PageNode>(`/api/pages/${selectedPage.id}`),
      );
      toast.success("Page moved.");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Could not move page.",
      );
    }
  };

  const archivePage = async () => {
    if (!selectedPage) return;
    try {
      await apiClient.patch(`/api/pages/${selectedPage.id}`, {
        isArchived: true,
      });
      setPages(
        await apiClient.get<PageNode[]>(`/api/workspaces/${activeId}/pages`),
      );
      setSelectedPage(null);
      toast.success("Page archived.");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Could not archive page.",
      );
    }
  };

  const savePagePermission = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPage) return;
    if (!permissionTarget) {
      toast.error("Choose a workspace member first.");
      return;
    }
    try {
      await apiClient.request(`/api/pages/${selectedPage.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({
          userId: permissionTarget,
          permission: permissionLevel,
        }),
      });
      setPagePermissions(
        await apiClient.get<PagePermission[]>(
          `/api/pages/${selectedPage.id}/permissions`,
        ),
      );
      toast.success("Page permission updated.");
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Could not update page permission.",
      );
    }
  };

  const addComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPage) return;
    if (!commentText.trim()) {
      toast.error("Write a comment before sending it.");
      return;
    }
    try {
      await apiClient.post(`/api/pages/${selectedPage.id}/comments`, {
        content: commentText,
      });
      setComments(
        await apiClient.get<CommentItem[]>(
          `/api/pages/${selectedPage.id}/comments`,
        ),
      );
      setCommentText("");
      toast.success("Comment added.");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Could not add comment.",
      );
    }
  };

  const resolveComment = async (comment: CommentItem) => {
    try {
      await apiClient.patch(`/api/comments/${comment.id}`, {
        isResolved: !comment.isResolved,
      });
      setComments((items) =>
        items.map((item) =>
          item.id === comment.id
            ? { ...item, isResolved: !item.isResolved }
            : item,
        ),
      );
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Could not update comment.",
      );
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await apiClient.delete(`/api/comments/${commentId}`);
      setComments((items) => items.filter((item) => item.id !== commentId));
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Could not delete comment.",
      );
    }
  };

  const replyToComment = async (
    commentId: string,
    content: string,
  ): Promise<boolean> => {
    if (!selectedPage) return false;
    if (!content.trim()) {
      toast.error("Write a reply before sending it.");
      return false;
    }
    try {
      await apiClient.post(`/api/comments/${commentId}/replies`, { content });
      setComments(
        await apiClient.get<CommentItem[]>(
          `/api/pages/${selectedPage.id}/comments`,
        ),
      );
      return true;
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Could not add reply.",
      );
      return false;
    }
  };

  const createWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    const workspaceName = name.trim();
    if (!workspaceName) {
      toast.error("Enter a workspace name.");
      return;
    }
    try {
      const created = await apiClient.post<Workspace>("/api/workspaces", {
        name: workspaceName,
      });
      setName("");
      toast.success("Workspace created.");
      await loadWorkspaces(created.id);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Could not create workspace.",
      );
    }
  };

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    try {
      const result = await apiClient.post<{ token: string }>(
        `/api/workspaces/${active.id}/invitations`,
        { email: inviteEmail.trim(), role: "MEMBER" },
      );
      setInviteToken(result.token);
      setInviteEmail("");
      toast.success(
        "Invitation created. Share the invitation code with the recipient.",
      );
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Could not create invitation.",
      );
    }
  };

  const acceptInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!acceptToken.trim()) {
      toast.error("Enter an invitation code.");
      return;
    }
    try {
      await apiClient.post(
        `/api/workspaces/invitations/${encodeURIComponent(acceptToken.trim())}/accept`,
      );
      setAcceptToken("");
      toast.success("Invitation accepted.");
      await loadWorkspaces();
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Could not accept invitation.",
      );
    }
  };

  const updateRole = async (member: Member, role: Workspace["role"]) => {
    if (!active) return;
    try {
      await apiClient.patch(
        `/api/workspaces/${active.id}/members/${member.id}`,
        { role },
      );
      setMembers((rows) =>
        rows.map((row) => (row.id === member.id ? { ...row, role } : row)),
      );
      toast.success(`${member.user.name}'s role updated.`);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Could not update member role.",
      );
    }
  };

  const removeMember = async (member: Member) => {
    if (!active) return;
    try {
      await apiClient.delete(
        `/api/workspaces/${active.id}/members/${member.id}`,
      );
      setMembers((rows) => rows.filter((row) => row.id !== member.id));
      toast.success(`${member.user.name} removed from this workspace.`);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Could not remove member.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 shadow-sm backdrop-blur sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-sm font-bold tracking-tight text-white shadow-sm">
            CW
          </div>
          <div>
            <span className="block text-sm font-semibold tracking-tight text-slate-900 sm:text-base">
              Collaborative Workspace
            </span>
            <span className="hidden text-xs text-slate-500 sm:block">
              Your team’s shared pages
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50 lg:hidden"
            aria-expanded={navigationOpen}
            aria-controls="workspace-navigation"
            onClick={() => setNavigationOpen((open) => !open)}
          >
            {navigationOpen ? <X size={16} /> : <Menu size={16} />}
            <span>{navigationOpen ? "Close" : "Navigate"}</span>
          </button>
          <span className="hidden rounded-full bg-slate-100 px-3 py-2 text-slate-700 sm:inline">
            {user?.name}
          </span>
          <button
            onClick={() =>
              void runPending("logout", async () => {
                setLoggingOut(true);
                try {
                  await logout();
                } finally {
                  setLoggingOut(false);
                }
              })
            }
            disabled={isPending("logout")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 disabled:opacity-60"
            aria-label="Sign out"
          >
            {loggingOut ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <LogOut size={15} />
            )}
            <span className="hidden sm:inline">
              {loggingOut ? "Signing out…" : "Sign out"}
            </span>
          </button>
        </div>
      </header>
      <main className="mx-auto grid max-w-screen-2xl items-start gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6 lg:px-8 lg:py-7">
        <aside
          id="workspace-navigation"
          className={`${navigationOpen ? "block" : "hidden"} self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-[5rem] lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:p-5`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <label
              className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
              htmlFor="workspace-select"
            >
              Workspace
            </label>
            {(membersLoading || pagesLoading) && (
              <span
                className="inline-flex items-center gap-1 text-[11px] text-slate-500"
                role="status"
              >
                <Loader2 size={12} className="animate-spin" /> Loading
              </span>
            )}
          </div>
          <div className="relative">
            <select
              id="workspace-select"
              value={activeId}
              onChange={(event) => {
                setActiveId(event.target.value);
                setNavigationOpen(false);
              }}
              className="ui-select w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
              disabled={!workspaces.length}
            >
              <option value="" disabled>
                Select workspace
              </option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>
          {active && (
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <div>
                <div className="text-slate-400">Your role</div>
                <strong className="mt-0.5 inline-block text-slate-800">
                  {active.role}
                </strong>
              </div>
              <div className="border-l border-slate-200 pl-3">
                <div className="text-slate-400">Team space</div>
                <strong className="mt-0.5 inline-block text-slate-800">
                  {active._count.members} members · {active._count.pages} pages
                </strong>
              </div>
            </div>
          )}
          {active && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Pages</h2>
                <button
                  onClick={() =>
                    void runPending("create-page", () => createPage())
                  }
                  disabled={isPending("create-page")}
                  aria-label="Create page"
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                >
                  {isPending("create-page") ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                </button>
              </div>
              {pagesLoading ? (
                <LoadingRows count={3} />
              ) : pages.length ? (
                <PageTree
                  pages={pages}
                  selectedId={selectedPage?.id || ""}
                  onSelect={(page) => {
                    setSelectedPage(page);
                    setPageTitle(page.title);
                    setNavigationOpen(false);
                  }}
                />
              ) : (
                <p className="py-2 text-xs text-slate-500">
                  No pages yet. Create one to get started.
                </p>
              )}
            </div>
          )}
          <details className="group mt-5 border-t border-slate-100 pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span>Create or join a workspace</span>
              <ChevronDown
                size={16}
                className="text-slate-400 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="mt-2 space-y-4 px-1">
              <form
                onSubmit={(event) =>
                  void runPending("create-workspace", () =>
                    createWorkspace(event),
                  )
                }
                noValidate
                className="space-y-2"
              >
                <label
                  htmlFor="workspace-name"
                  className="mb-2 block text-sm font-medium"
                >
                  Create workspace
                </label>
                <input
                  id="workspace-name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Team name"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  disabled={isPending("create-workspace")}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {isPending("create-workspace") ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Plus size={15} />
                  )}
                  {isPending("create-workspace") ? "Creating…" : "Create"}
                </button>
              </form>
              <form
                onSubmit={(event) =>
                  void runPending("accept-invite", () => acceptInvite(event))
                }
                noValidate
                className="border-t border-slate-100 pt-4"
              >
                <label
                  htmlFor="invite-code"
                  className="mb-2 block text-sm font-medium"
                >
                  Join a workspace
                </label>
                <input
                  id="invite-code"
                  required
                  value={acceptToken}
                  onChange={(event) => setAcceptToken(event.target.value)}
                  placeholder="Invitation code"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  disabled={isPending("accept-invite")}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  {isPending("accept-invite") && (
                    <Loader2 size={15} className="animate-spin" />
                  )}
                  {isPending("accept-invite")
                    ? "Accepting…"
                    : "Accept invitation"}
                </button>
              </form>
            </div>
          </details>
        </aside>
        <section className="min-w-0 self-start space-y-6">
          {loading ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin text-emerald-700" />
              <span>Loading workspaces…</span>
            </div>
          ) : !active ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <h1 className="text-xl font-semibold">No workspace yet</h1>
              <p className="mt-2 text-sm text-slate-500">
                Create one or accept an invitation to start working with your
                team.
              </p>
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="min-w-0 truncate text-lg font-semibold">
                    {selectedPage ? selectedPage.title : "Workspace overview"}
                  </h2>
                  {selectedPage && (
                    <button
                      type="button"
                      onClick={() => setSelectedPage(null)}
                      className="shrink-0 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      Workspace overview
                    </button>
                  )}
                </div>
                {selectedPage ? (
                  <>
                    <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      {selectedPage.effectivePermission === "EDIT"
                        ? "Can edit"
                        : selectedPage.effectivePermission === "COMMENT"
                          ? "Can comment"
                          : "View only"}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(active.role === "OWNER" || active.role === "ADMIN") && (
                        <form
                          onSubmit={(event) =>
                            void runPending("rename-page", () =>
                              renamePage(event),
                            )
                          }
                          noValidate
                          className="flex min-w-0 flex-1 gap-2"
                        >
                          <input
                            aria-label="Page title"
                            value={pageTitle}
                            onChange={(event) =>
                              setPageTitle(event.target.value)
                            }
                            placeholder={selectedPage.title}
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                          <button
                            disabled={isPending("rename-page")}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                          >
                            {isPending("rename-page") && (
                              <Loader2 size={14} className="animate-spin" />
                            )}
                            {isPending("rename-page") ? "Saving…" : "Rename"}
                          </button>
                        </form>
                      )}
                      {selectedPage.effectivePermission === "EDIT" && (
                        <button
                          type="button"
                          onClick={() =>
                            void runPending("create-page", () =>
                              createPage(selectedPage.id),
                            )
                          }
                          disabled={isPending("create-page")}
                          className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                        >
                          {isPending("create-page") ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 size={14} className="animate-spin" />
                              Creating…
                            </span>
                          ) : (
                            "New subpage"
                          )}
                        </button>
                      )}
                    </div>
                    {(active.role === "OWNER" || active.role === "ADMIN") && (
                      <>
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                          <select
                            aria-label="Move page under"
                            value={moveTarget}
                            onChange={(event) =>
                              setMoveTarget(event.target.value)
                            }
                            className="ui-select min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          >
                            <option value="">Move to workspace root</option>
                            {flattenPages(pages)
                              .filter((page) => page.id !== selectedPage.id)
                              .map((page) => (
                                <option key={page.id} value={page.id}>
                                  {page.title}
                                </option>
                              ))}
                          </select>
                          <button
                            onClick={() =>
                              void runPending("move-page", movePage)
                            }
                            disabled={isPending("move-page")}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                          >
                            {isPending("move-page") ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                Moving…
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                <MoveRight size={14} />
                                Move
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() =>
                              void runPending("archive-page", archivePage)
                            }
                            disabled={isPending("archive-page")}
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            {isPending("archive-page") ? (
                              <span className="inline-flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                Archiving…
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2">
                                <Archive size={14} />
                                Archive
                              </span>
                            )}
                          </button>
                        </div>
                        <div className="mt-5 border-t border-slate-100 pt-4">
                          <h3 className="text-sm font-semibold">Page access</h3>
                          <div className="mt-2 space-y-1">
                            {permissionsLoading ? (
                              <LoadingRows count={2} />
                            ) : (
                              pagePermissions.map((entry) => (
                                <div
                                  key={entry.userId}
                                  className="text-xs text-slate-600"
                                >
                                  {entry.user.name}{" "}
                                  <span className="text-slate-400">
                                    ({entry.user.email})
                                  </span>
                                  : <strong>{entry.permission}</strong>
                                </div>
                              ))
                            )}
                          </div>
                          <form
                            onSubmit={(event) =>
                              void runPending("save-permission", () =>
                                savePagePermission(event),
                              )
                            }
                            noValidate
                            className="mt-3 flex flex-col gap-2 sm:flex-row"
                          >
                            <select
                              aria-label="Member"
                              required
                              value={permissionTarget}
                              disabled={
                                membersLoading || isPending("save-permission")
                              }
                              onChange={(event) =>
                                setPermissionTarget(event.target.value)
                              }
                              className="ui-select min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            >
                              <option value="">
                                {membersLoading
                                  ? "Loading members…"
                                  : "Select member"}
                              </option>
                              {members
                                .filter((member) => member.role !== "OWNER")
                                .map((member) => (
                                  <option
                                    key={member.user.id}
                                    value={member.user.id}
                                  >
                                    {member.user.name}
                                  </option>
                                ))}
                            </select>
                            <select
                              aria-label="Permission level"
                              value={permissionLevel}
                              onChange={(event) =>
                                setPermissionLevel(
                                  event.target
                                    .value as PagePermission["permission"],
                                )
                              }
                              className="ui-select rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            >
                              <option value="VIEW">View</option>
                              <option value="COMMENT">Comment</option>
                              <option value="EDIT">Edit</option>
                            </select>
                            <button
                              disabled={isPending("save-permission")}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                            >
                              {isPending("save-permission") && (
                                <Loader2 size={14} className="animate-spin" />
                              )}
                              {isPending("save-permission")
                                ? "Saving…"
                                : "Set access"}
                            </button>
                          </form>
                        </div>
                      </>
                    )}
                    {user && (
                      <CollaborativeEditor
                        key={selectedPage.id}
                        pageId={selectedPage.id}
                        user={user}
                        editable={selectedPage.effectivePermission === "EDIT"}
                      />
                    )}
                    <div className="mt-6 border-t border-slate-100 pt-5">
                      <h3 className="flex items-center gap-2 font-semibold">
                        <MessageSquare size={16} />
                        Comments
                      </h3>
                      <div className="mt-3 space-y-3">
                        {commentsLoading ? (
                          <LoadingRows count={2} />
                        ) : (
                          comments.map((comment) => (
                            <article
                              key={comment.id}
                              className={`rounded-lg border p-3 ${comment.isResolved ? "border-slate-100 bg-slate-50 opacity-75" : "border-slate-200"}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium">
                                    {comment.author.name}
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                    {comment.content}
                                  </p>
                                </div>
                                {(comment.authorId === user?.id ||
                                  active.role === "OWNER" ||
                                  active.role === "ADMIN") && (
                                  <div className="flex shrink-0 gap-1">
                                    <button
                                      onClick={() =>
                                        void runPending(
                                          `resolve:${comment.id}`,
                                          () => resolveComment(comment),
                                        )
                                      }
                                      disabled={isPending(
                                        `resolve:${comment.id}`,
                                      )}
                                      className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-60"
                                    >
                                      {isPending(`resolve:${comment.id}`)
                                        ? "Saving…"
                                        : comment.isResolved
                                          ? "Reopen"
                                          : "Resolve"}
                                    </button>
                                    <button
                                      onClick={() =>
                                        void runPending(
                                          `delete-comment:${comment.id}`,
                                          () => deleteComment(comment.id),
                                        )
                                      }
                                      disabled={isPending(
                                        `delete-comment:${comment.id}`,
                                      )}
                                      className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                                    >
                                      {isPending(`delete-comment:${comment.id}`)
                                        ? "Deleting…"
                                        : "Delete"}
                                    </button>
                                  </div>
                                )}
                              </div>
                              {comment.replies.map((reply) => (
                                <div
                                  key={reply.id}
                                  className="ml-3 mt-3 border-l-2 border-slate-100 pl-3"
                                >
                                  <div className="text-xs font-medium">
                                    {reply.author.name}
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                                    {reply.content}
                                  </p>
                                </div>
                              ))}
                              {selectedPage.effectivePermission !== "VIEW" && (
                                <form
                                  className="mt-3 flex gap-2"
                                  noValidate
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    const form = event.currentTarget;
                                    const data = new FormData(form);
                                    void runPending(`reply:${comment.id}`, () =>
                                      replyToComment(
                                        comment.id,
                                        String(data.get("reply") || ""),
                                      ),
                                    ).then((sent) => {
                                      if (sent) form.reset();
                                    });
                                  }}
                                >
                                  <input
                                    name="reply"
                                    aria-label="Reply"
                                    maxLength={5000}
                                    placeholder="Write a reply…"
                                    className="min-w-0 flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs"
                                  />
                                  <button
                                    disabled={isPending(`reply:${comment.id}`)}
                                    className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-60"
                                  >
                                    {isPending(`reply:${comment.id}`) && (
                                      <Loader2
                                        size={12}
                                        className="animate-spin"
                                      />
                                    )}
                                    {isPending(`reply:${comment.id}`)
                                      ? "Sending…"
                                      : "Reply"}
                                  </button>
                                </form>
                              )}
                            </article>
                          ))
                        )}
                        {!commentsLoading && !comments.length && (
                          <p className="text-sm text-slate-500">
                            No comments yet.
                          </p>
                        )}
                      </div>
                      {selectedPage.effectivePermission !== "VIEW" && (
                        <form
                          onSubmit={(event) =>
                            void runPending("add-comment", () =>
                              addComment(event),
                            )
                          }
                          noValidate
                          className="mt-4 space-y-2"
                        >
                          <label htmlFor="comment-text" className="sr-only">
                            Add a comment
                          </label>
                          <textarea
                            id="comment-text"
                            required
                            maxLength={5000}
                            value={commentText}
                            onChange={(event) =>
                              setCommentText(event.target.value)
                            }
                            placeholder="Add a comment…"
                            rows={3}
                            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                          <button
                            disabled={isPending("add-comment")}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                          >
                            {isPending("add-comment") && (
                              <Loader2 size={14} className="animate-spin" />
                            )}
                            {isPending("add-comment")
                              ? "Sending…"
                              : "Add comment"}
                          </button>
                        </form>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    Choose a page from the sidebar to view its details.
                  </p>
                )}
              </section>
              {!selectedPage && (
                <>
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                        <Users size={20} />
                      </div>
                      <div>
                        <h1 className="text-xl font-semibold">{active.name}</h1>
                        <p className="mt-1 text-sm text-slate-500">
                          Manage workspace membership and invitations.
                        </p>
                      </div>
                    </div>
                    <div className="mt-6 divide-y divide-slate-100">
                      {membersLoading ? (
                        <LoadingRows count={3} />
                      ) : (
                        members.map((member) => (
                          <div
                            key={member.id}
                            className="flex flex-wrap items-center justify-between gap-3 py-3"
                          >
                            <div className="flex items-center gap-3">
                              {member.user.avatarUrl ? (
                                <img
                                  src={member.user.avatarUrl}
                                  alt=""
                                  className="h-9 w-9 rounded-full bg-slate-100"
                                />
                              ) : (
                                <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-sm">
                                  {member.user.name.slice(0, 1)}
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-medium">
                                  {member.user.name}
                                  {member.user.id === user?.id ? " (you)" : ""}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {member.user.email}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">
                                {member.role}
                              </span>
                              {(active.role === "OWNER" ||
                                active.role === "ADMIN") &&
                                member.role !== "OWNER" && (
                                  <>
                                    <select
                                      aria-label={`Role for ${member.user.name}`}
                                      value={member.role}
                                      disabled={isPending(`role:${member.id}`)}
                                      onChange={(event) =>
                                        void runPending(
                                          `role:${member.id}`,
                                          () =>
                                            updateRole(
                                              member,
                                              event.target
                                                .value as Workspace["role"],
                                            ),
                                        )
                                      }
                                      className="ui-select rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                    >
                                      <option value="MEMBER">Member</option>
                                      <option value="ADMIN">Admin</option>
                                    </select>
                                    {isPending(`role:${member.id}`) && (
                                      <span
                                        className="inline-flex items-center gap-1 text-xs text-slate-500"
                                        role="status"
                                      >
                                        <Loader2
                                          size={12}
                                          className="animate-spin"
                                        />
                                        Updating
                                      </span>
                                    )}
                                    <button
                                      onClick={() =>
                                        void runPending(
                                          `remove:${member.id}`,
                                          () => removeMember(member),
                                        )
                                      }
                                      disabled={isPending(
                                        `remove:${member.id}`,
                                      )}
                                      className="rounded-lg px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                                    >
                                      {isPending(`remove:${member.id}`)
                                        ? "Removing…"
                                        : "Remove"}
                                    </button>
                                  </>
                                )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                  {(active.role === "OWNER" || active.role === "ADMIN") && (
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                      <h2 className="font-semibold">Invite a member</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Create a one-time invitation code for a registered
                        account.
                      </p>
                      <form
                        onSubmit={(event) =>
                          void runPending("invite", () => invite(event))
                        }
                        noValidate
                        className="mt-4 flex flex-col gap-2 sm:flex-row"
                      >
                        <input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(event) =>
                            setInviteEmail(event.target.value)
                          }
                          placeholder="teammate@example.com"
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <button
                          disabled={isPending("invite")}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                        >
                          {isPending("invite") && (
                            <Loader2 size={14} className="animate-spin" />
                          )}
                          {isPending("invite")
                            ? "Creating…"
                            : "Create invitation"}
                        </button>
                      </form>
                      {inviteToken && (
                        <div className="mt-4 rounded-lg bg-slate-50 p-3">
                          <div className="text-xs font-semibold text-slate-600">
                            Invitation code
                          </div>
                          <div className="mt-2 flex gap-2">
                            <code className="min-w-0 flex-1 break-all text-xs">
                              {inviteToken}
                            </code>
                            <button
                              disabled={copying}
                              onClick={async () => {
                                setCopying(true);
                                try {
                                  await navigator.clipboard.writeText(
                                    inviteToken,
                                  );
                                  setCopied(true);
                                  toast.success("Invitation code copied.");
                                } catch {
                                  toast.error(
                                    "Could not copy invitation code.",
                                  );
                                } finally {
                                  setCopying(false);
                                }
                              }}
                              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-60"
                            >
                              {copying ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : copied ? (
                                <Check size={13} />
                              ) : (
                                <Copy size={13} />
                              )}{" "}
                              {copying
                                ? "Copying…"
                                : copied
                                  ? "Copied"
                                  : "Copy"}
                            </button>
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ProtectedRoute>
          <WorkspaceShell />
        </ProtectedRoute>
      </AuthProvider>
    </ToastProvider>
  );
}
export default App;
