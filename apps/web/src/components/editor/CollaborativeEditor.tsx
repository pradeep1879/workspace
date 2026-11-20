import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading2,
  Loader2,
  Undo2,
  Redo2,
} from "lucide-react";
import type { UserProfile } from "@collab/contracts";
import { apiClient } from "../../lib/apiClient";

function getCollaborationUrl() {
  const configuredUrl =
    import.meta.env.VITE_COLLAB_WS_URL || "ws://localhost:4001";
  const url = new URL(configuredUrl);

  // Hocuspocus is bound to 0.0.0.0 (IPv4). Some browsers resolve localhost
  // to ::1 first, where that listener is unavailable. Pin local connections
  // to IPv4 while preserving configured hosts in non-local environments.
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    const appHost = window.location.hostname;
    const isLoopback = (host: string) =>
      host === "localhost" || host === "127.0.0.1" || host === "::1";

    // When the web app is opened from another device on the LAN, localhost
    // would point that device back to itself. Reuse the web app's host so all
    // workspace members reach the same collaboration server.
    if (isLoopback(url.hostname) && !isLoopback(appHost)) {
      url.hostname = appHost;
    } else if (appHost === "localhost" && url.hostname === "localhost") {
      // The local collaboration service binds to IPv4.
      url.hostname = "127.0.0.1";
    }
  }

  return url.toString();
}

function stableColor(userId: string) {
  let hash = 0;
  for (const character of userId)
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 66% 43%)`;
}

type Collaborator = {
  clientId: number;
  user: { id?: string; name: string; avatarUrl?: string | null; color: string };
};

export function CollaborativeEditor({
  pageId,
  user,
  editable,
}: {
  pageId: string;
  user: UserProfile;
  editable: boolean;
}) {
  const [status, setStatus] = useState("connecting");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [socketOpened, setSocketOpened] = useState(false);
  const [persistedVersion, setPersistedVersion] = useState<number | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const collaboration = useMemo(() => {
    const document = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: getCollaborationUrl(),
      name: pageId,
      document,
      token: async () => {
        try {
          const { token } = await apiClient.post<{ token: string }>(
            "/api/auth/collaboration-token",
            {},
          );
          if (!token)
            throw new Error("API returned an empty collaboration token");
          return token;
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          setConnectionError(`Could not get collaboration token: ${reason}`);
          setStatus("failed");
          throw error;
        }
      },
      onOpen: () => setSocketOpened(true),
      onClose: () => setSocketOpened(false),
      onStatus: ({ status: connectionStatus }) => {
        setStatus(connectionStatus);
        if (connectionStatus === "connected") setSocketOpened(true);
        if (connectionStatus === "disconnected") setSocketOpened(false);
      },
      onAuthenticationFailed: ({ reason }) => {
        setConnectionError(reason);
        setStatus("failed");
      },
      onAuthenticated: () => {
        setConnectionError(null);
        setStatus("connected");
      },
      onSynced: ({ state }) => {
        if (state)
          setStatus((current) =>
            current === "connecting" ? "connected" : current,
          );
      },
      onStateless: ({ payload }) => {
        try {
          const message = JSON.parse(payload) as {
            type?: string;
            version?: number;
          };
          if (
            message.type === "persisted" &&
            typeof message.version === "number"
          ) {
            setPersistedVersion(message.version);
          }
        } catch {
          // Ignore stateless messages owned by other extensions.
        }
      },
      onAwarenessUpdate: ({ states }) => {
        const activeByUser = new Map<string, Collaborator>();
        states.forEach((state) => {
          const collaborator = state.user as Collaborator["user"] | undefined;
          if (!collaborator?.name || collaborator.id === user.id) return;

          // A person may have this page open in multiple tabs or browsers.
          // Presence is shown per person, while Yjs still keeps each client.
          const identity = collaborator.id
            ? `user:${collaborator.id}`
            : `client:${state.clientId}`;
          activeByUser.set(identity, {
            clientId: state.clientId,
            user: collaborator,
          });
        });
        const nextCollaborators = [...activeByUser.values()];
        setCollaborators((current) => {
          const identity = (collaborator: Collaborator) =>
            collaborator.user.id
              ? `user:${collaborator.user.id}`
              : `client:${collaborator.clientId}`;
          if (current.length !== nextCollaborators.length) {
            return nextCollaborators;
          }

          const currentByIdentity = new Map(
            current.map((collaborator) => [
              identity(collaborator),
              collaborator,
            ]),
          );
          const unchanged = nextCollaborators.every((collaborator) => {
            const previous = currentByIdentity.get(identity(collaborator));
            return (
              previous?.user.name === collaborator.user.name &&
              previous?.user.color === collaborator.user.color &&
              previous?.user.avatarUrl === collaborator.user.avatarUrl
            );
          });
          return unchanged ? current : nextCollaborators;
        });
      },
    });
    provider.setAwarenessField("user", {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      color: stableColor(user.id),
    });
    return { document, provider };
  }, [pageId, user.id, user.name, user.avatarUrl]);

  const editor = useEditor(
    {
      editable,
      shouldRerenderOnTransaction: false,
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: collaboration.document }),
        CollaborationCursor.configure({
          provider: collaboration.provider,
          user: {
            id: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            color: stableColor(user.id),
          },
        }),
        Placeholder.configure({ placeholder: "Start writing…" }),
      ],
      editorProps: {
        attributes: {
          class: "tiptap-content focus:outline-none",
          "aria-label": `${user.name}'s collaborative page editor`,
        },
      },
    },
    [collaboration, editable],
  );

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) {
        return {
          bold: false,
          italic: false,
          heading: false,
          bulletList: false,
          orderedList: false,
          blockquote: false,
          canUndo: false,
          canRedo: false,
        };
      }
      return {
        bold: currentEditor.isActive("bold"),
        italic: currentEditor.isActive("italic"),
        heading: currentEditor.isActive("heading", { level: 2 }),
        bulletList: currentEditor.isActive("bulletList"),
        orderedList: currentEditor.isActive("orderedList"),
        blockquote: currentEditor.isActive("blockquote"),
        canUndo: currentEditor.can().undo(),
        canRedo: currentEditor.can().redo(),
      };
    },
  });

  useEffect(
    () => () => {
      collaboration.provider.destroy();
      collaboration.document.destroy();
    },
    [collaboration],
  );

  useEffect(() => {
    if (
      status === "connected" ||
      status === "failed" ||
      status === "disconnected"
    )
      return;
    const timeout = window.setTimeout(() => {
      setConnectionError(
        socketOpened
          ? "WebSocket opened, but authentication did not complete. Check the collaboration server logs."
          : "Could not open a WebSocket to the collaboration server. Check that it is running and that VITE_COLLAB_WS_URL is correct.",
      );
      setStatus("failed");
    }, 12000);
    return () => window.clearTimeout(timeout);
  }, [status, socketOpened]);

  const isConnected = status === "connected";
  const saveLabel = !isConnected
    ? status === "failed"
      ? (connectionError ?? "Connection failed")
      : status === "connecting"
        ? "Connecting…"
        : status === "authenticating"
          ? "Authenticating…"
          : status === "disconnected"
            ? "Disconnected"
            : "Reconnecting…"
    : persistedVersion === null
      ? "Connected · waiting for changes"
      : `Saved · v${persistedVersion}`;

  return (
    <section
      className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white"
      aria-label="Collaborative editor"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label="Active collaborators"
        >
          {collaborators.map(({ clientId, user: collaborator }) => (
            <span
              key={collaborator.id ?? clientId}
              title={collaborator.name}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 py-1 pl-1 pr-2 text-xs text-slate-600"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: collaborator.color }}
              />
              {collaborator.name}
            </span>
          ))}
          <span className="text-xs text-slate-400">
            {collaborators.length} online
          </span>
        </div>
        <div
          role="status"
          title={connectionError ?? undefined}
          className={`inline-flex items-center gap-1.5 text-xs ${isConnected ? "text-emerald-700" : status === "failed" ? "text-red-700" : "text-amber-700"}`}
        >
          {!isConnected && status !== "failed" && status !== "disconnected" && (
            <Loader2 size={13} className="animate-spin" />
          )}
          <span>{saveLabel}</span>
        </div>
      </div>
      {editor ? (
        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-3 py-2">
          <ToolbarButton
            label="Bold"
            disabled={!editable}
            active={toolbarState?.bold ?? false}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            disabled={!editable}
            active={toolbarState?.italic ?? false}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic size={15} />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 2"
            disabled={!editable}
            active={toolbarState?.heading ?? false}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 size={15} />
          </ToolbarButton>
          <ToolbarButton
            label="Bullet list"
            disabled={!editable}
            active={toolbarState?.bulletList ?? false}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton
            label="Numbered list"
            disabled={!editable}
            active={toolbarState?.orderedList ?? false}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={15} />
          </ToolbarButton>
          <ToolbarButton
            label="Block quote"
            disabled={!editable}
            active={toolbarState?.blockquote ?? false}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote size={15} />
          </ToolbarButton>
          <span className="mx-1 border-l border-slate-200" />
          <ToolbarButton
            label="Undo"
            disabled={!editable || !toolbarState?.canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 size={15} />
          </ToolbarButton>
          <ToolbarButton
            label="Redo"
            disabled={!editable || !toolbarState?.canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 size={15} />
          </ToolbarButton>
        </div>
      ) : (
        <div
          className="space-y-3 p-5"
          role="status"
          aria-label="Loading editor"
        >
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
          <span className="sr-only">Loading editor…</span>
        </div>
      )}
      <EditorContent editor={editor} />
      {!editable && (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          You have read-only access to this page.
        </p>
      )}
    </section>
  );
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md disabled:cursor-not-allowed disabled:opacity-40 ${active ? "bg-emerald-100 text-emerald-800" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {children}
    </button>
  );
}
