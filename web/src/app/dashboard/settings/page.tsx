"use client";

import { clsx } from "clsx";
import {
  BellOff,
  BellRing,
  Check,
  Copy,
  Globe,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { PasswordStrength } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/Button";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { QueryValue } from "@/components/ui/QueryValue";
import { Skeleton } from "@/components/ui/Skeleton";
import { env } from "@/config/env";
import { accountSummary, useAccountController } from "@/controllers/account";
import { durationLabel } from "@/controllers/shell";
import { ApiError } from "@/models";

function Card({
  title,
  description,
  icon: Icon,
  tone = "default",
  aside,
  children,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  tone?: "default" | "danger";
  aside?: ReactNode;
  children: ReactNode;
}) {
  const id = title.toLowerCase().replace(/\s+/g, "-");
  const danger = tone === "danger";
  return (
    <section
      aria-labelledby={id}
      className={clsx(
        "flex min-w-0 flex-col rounded-(--radius) border",
        danger ? "border-crit/40 bg-crit/5" : "border-border bg-bg-elev",
      )}
    >
      <header
        className={clsx(
          "flex items-start gap-3 border-b px-5 py-4",
          danger ? "border-crit/30" : "border-border",
        )}
      >
        <span
          className={clsx(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            danger
              ? "bg-crit/15 text-crit-text"
              : "bg-brand/15 text-brand-text",
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2
            id={id}
            className={clsx(
              "text-[15px] font-semibold",
              danger && "text-crit-text",
            )}
          >
            {title}
          </h2>
          {description && (
            <p className="text-[12.5px] leading-[1.45] text-text-2">
              {description}
            </p>
          )}
        </div>
        {aside && <div className="text-[12px] text-text-2">{aside}</div>}
      </header>
      <div className="flex flex-col gap-4 px-5 py-5">{children}</div>
    </section>
  );
}

function Saved({ message }: { message: string | null }) {
  return message ? (
    <p
      role="status"
      className="flex items-center gap-1.5 text-[13px] text-ok-text"
    >
      <Check aria-hidden="true" className="size-3.5" />
      {message}
    </p>
  ) : null;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-text-2 transition-colors duration-[var(--duration-fast)] hover:bg-bg hover:text-text"
    >
      {copied ? (
        <Check aria-hidden="true" className="size-3.5 text-ok-text" />
      ) : (
        <Copy aria-hidden="true" className="size-3.5" />
      )}
    </button>
  );
}

function Row({
  icon: Icon,
  title,
  detail,
  right,
}: {
  icon: LucideIcon;
  title: string;
  detail: ReactNode;
  right?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-[8px] border border-border bg-bg px-3 py-2.5">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-text-2" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-medium">{title}</span>
        <span className="truncate text-[12px] text-text-2">{detail}</span>
      </div>
      {right}
    </li>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "ok" | "muted";
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "ok" ? "bg-ok/15 text-ok-text" : "bg-border text-text-2",
      )}
    >
      {children}
    </span>
  );
}

/**
 * /dashboard/settings — the account: UpdateUser (name, email, password),
 * what it owns, where alerts go, the session, the public status page
 * (GetStatusPage by owner id) and DeleteUser.
 */
export default function SettingsPage() {
  const {
    user,
    saving,
    save,
    deleteAccount,
    signOut,
    monitors,
    incidents,
    session,
  } = useAccountController();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const t = window.setTimeout(() => {
      setName(user.name);
      setEmail(user.email);
    }, 0);
    return () => window.clearTimeout(t);
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col gap-5 px-6 py-5">
        <Skeleton kind="panel-axis" style={{ height: 120 }} />
        <Skeleton kind="panel-axis" style={{ height: 320 }} />
      </div>
    );
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError("Name and email can't be empty.");
      return;
    }
    try {
      await save({
        name: name.trim() !== user!.name ? name.trim() : undefined,
        email: email.trim() !== user!.email ? email.trim() : undefined,
      });
      setProfileMsg("Profile saved.");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "already_exists"
          ? "Another account already uses that email."
          : err instanceof Error
            ? err.message
            : "Saving failed.",
      );
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    setError(null);
    if (password.length === 0) {
      setError("Enter a new password.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    try {
      await save({ password });
      setPassword("");
      setConfirm("");
      setPasswordMsg("Password updated. You can now sign in with your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saving failed.");
    }
  }

  const statusPath = `/status/owner/${user.id}`;
  // the desktop app has no public pages of its own — link to the web app
  const statusHref = env.desktop ? `${env.webUrl}${statusPath}` : statusPath;
  const statusUrl = env.desktop ? statusHref : `${env.webUrl}${statusPath}`;

  // render-pure "now": the last refresh, not Date.now()
  const now = monitors.updatedAt ?? 0;
  const loaded = monitors.data !== null && incidents.data !== null;
  const sum = accountSummary(monitors.data ?? [], incidents.data ?? [], now);
  const profileDirty = name.trim() !== user.name || email.trim() !== user.email;
  const sessionLeft =
    session && now
      ? Math.max(0, Math.round((session.expiresAt - now) / 1000))
      : null;

  return (
    <div className="flex flex-col gap-5 px-6 py-5" data-testid="settings">
      {/* identity hero */}
      <header className="relative flex flex-wrap items-center gap-5 overflow-hidden rounded-(--radius) border border-border bg-bg-elev px-6 py-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-0 size-[280px] rounded-full bg-brand/10 blur-3xl"
        />
        <span
          aria-hidden="true"
          className="relative flex size-16 shrink-0 items-center justify-center rounded-full bg-brand text-[22px] font-semibold text-on-brand ring-4 ring-brand/20"
        >
          {initials(name || user.name)}
        </span>
        <div className="relative flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[11px] uppercase tracking-wide text-text-2">
            Settings
          </p>
          <h1 className="truncate text-[24px] font-semibold">{user.name}</h1>
          <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-2">
            <span className="flex min-w-0 max-w-full items-center gap-1.5">
              <Mail aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{user.email}</span>
            </span>
            <span className="font-data flex min-w-0 max-w-full items-center gap-1 text-[12px]">
              <span className="truncate">id {user.id}</span>
              <CopyButton text={user.id} label="Copy account ID" />
            </span>
          </p>
        </div>
        <div className="relative flex items-center gap-2 rounded-full border border-ok/30 bg-ok/10 px-3 py-1 text-[12px] text-ok-text">
          <ShieldCheck aria-hidden="true" className="size-3.5" />
          Signed in
          {sessionLeft !== null && (
            <span className="text-text-2">
              · {durationLabel(sessionLeft)} left
            </span>
          )}
        </div>
      </header>

      {/* what the account owns */}
      <div
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        aria-label="Account overview"
      >
        {loaded ? (
          <>
            <QueryValue
              className="w-full"
              label="Monitors"
              value={`${sum.up}/${sum.monitors} up`}
              threshold={sum.down > 0 ? "crit" : sum.monitors ? "ok" : "none"}
            />
            <QueryValue
              className="w-full"
              label="Checks / day"
              value={sum.checksPerDay.toLocaleString("en-US")}
            />
            <QueryValue
              className="w-full"
              label="Incidents · 30d"
              value={String(sum.incidents30d)}
              threshold={sum.openIncidents > 0 ? "crit" : "none"}
            />
            <QueryValue
              className="w-full"
              label="MTTR · 30d"
              value={
                sum.mttrSeconds === null ? "—" : durationLabel(sum.mttrSeconds)
              }
            />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => (
            <Skeleton key={i} kind="panel-axis" style={{ height: 84 }} />
          ))
        )}
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-crit-text">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card
            title="Profile"
            icon={User}
            description="Your name appears on your status page; alerts go to this email."
            aside={profileDirty ? "unsaved" : undefined}
          >
            <form
              onSubmit={(e) => void saveProfile(e)}
              noValidate
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  Name
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  Email
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
              </div>
              {email.trim() !== user.email && email.trim() && (
                <p className="rounded-[8px] border border-warn/30 bg-warn/10 px-3 py-2 text-[12.5px] text-warn-text">
                  Downtime emails and email sign-in will move to{" "}
                  <span className="font-data">{email.trim()}</span>.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={saving || !profileDirty}>
                  Save profile
                </Button>
                <Saved message={profileMsg} />
              </div>
            </form>
          </Card>

          <Card
            title="Password"
            icon={KeyRound}
            description="Sets the password for email sign-in. Accounts created with Google have none until one is set here."
          >
            <form
              onSubmit={(e) => void savePassword(e)}
              noValidate
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  New password
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                  Confirm new password
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-2 text-[12px] text-text-2">
                <PasswordStrength password={password} />
                {confirm && (
                  <span
                    className={
                      confirm === password ? "text-ok-text" : "text-crit-text"
                    }
                  >
                    {confirm === password
                      ? "Passwords match"
                      : "Passwords don't match yet"}
                  </span>
                )}
              </div>
              <p className="text-[12px] leading-[1.45] text-text-2">
                Stored as a bcrypt hash by the API — never in plain text, never
                sent back to the browser.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={saving}>
                  Update password
                </Button>
                <Saved message={passwordMsg} />
              </div>
            </form>
          </Card>

          <Card
            title="Public status page"
            icon={Globe}
            description="Every account has a public page listing all of its monitors and incidents. Anyone with the link can view it."
          >
            <div className="flex items-center gap-2 rounded-[8px] border border-border bg-bg px-3 py-2">
              <ExternalLink
                href={statusHref}
                className="font-data min-w-0 flex-1 truncate text-[13px] text-brand-text hover:underline"
                data-testid="status-page-link"
              >
                {statusPath}
              </ExternalLink>
              <CopyButton text={statusUrl} label="Copy status page link" />
            </div>
            <p className="text-[12px] text-text-2">
              Shows {sum.monitors} monitor{sum.monitors === 1 ? "" : "s"} —
              names, uptime and incidents only. Targets and settings stay
              private.
            </p>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-4">
          <Card
            title="Notifications"
            icon={BellRing}
            description="Delivered from a durable outbox — retried with backoff if the provider is down."
          >
            <ul className="flex flex-col gap-2">
              <Row
                icon={Mail}
                title="Monitor goes down"
                detail={`Email to ${user.email}`}
                right={<Badge tone="ok">Email</Badge>}
              />
              <Row
                icon={Check}
                title="Monitor recovers"
                detail="Email with total downtime"
                right={<Badge tone="ok">Email</Badge>}
              />
              <Row
                icon={BellRing}
                title="Incident opens or resolves"
                detail="On-screen toast · native notification in the desktop app"
                right={<Badge tone="muted">In-app</Badge>}
              />
              <Row
                icon={BellOff}
                title="Muted monitors"
                detail={
                  sum.muted === 0
                    ? "None — every monitor alerts"
                    : `${sum.muted} monitor${sum.muted === 1 ? "" : "s"} won't email`
                }
                right={
                  <Link
                    href="/dashboard"
                    className="shrink-0 text-[12px] text-brand-text hover:underline"
                  >
                    Manage
                  </Link>
                }
              />
            </ul>
          </Card>

          <Card title="Session" icon={ShieldCheck}>
            <ul className="flex flex-col gap-2">
              <Row
                icon={KeyRound}
                title="Signed-in token"
                detail={
                  session
                    ? `JWT · expires ${new Date(session.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : "Bearer token for this session"
                }
                right={
                  sessionLeft !== null ? (
                    <Badge tone="ok">{durationLabel(sessionLeft)}</Badge>
                  ) : undefined
                }
              />
              <Row
                icon={ShieldCheck}
                title="Stored in session storage"
                detail="Cleared when this window closes — never written to disk"
              />
              <Row
                icon={Globe}
                title="Sign-in methods"
                detail="Email & password · Continue with Google"
              />
            </ul>
            <Button
              kind="quiet"
              onClick={() => void signOut()}
              className="w-fit"
            >
              <LogOut aria-hidden="true" className="size-4" />
              End session
            </Button>
          </Card>

          <Card
            title="Danger zone"
            icon={Trash2}
            tone="danger"
            description="Removes your account and signs you out."
          >
            <Button
              kind="destructive"
              onClick={() => setConfirmDelete(true)}
              className="w-fit"
            >
              Delete account
            </Button>
          </Card>
        </aside>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your account?"
        variant="sm"
        footer={
          <>
            <Button kind="quiet" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              kind="destructive"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await deleteAccount();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Delete failed.",
                  );
                  setDeleting(false);
                  setConfirmDelete(false);
                }
              }}
            >
              Delete account
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-[1.45] text-text-2">
          You won&apos;t be able to sign in again with this account. This
          can&apos;t be undone.
        </p>
      </Modal>
    </div>
  );
}
