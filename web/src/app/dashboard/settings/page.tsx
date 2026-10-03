"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAccountController } from "@/controllers/account";

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-(--radius) border border-border p-5"
    >
      <header className="flex flex-col gap-1">
        <h2 id={id} className="text-[16px] font-semibold">
          {title}
        </h2>
        {description && (
          <p className="text-[13px] leading-[1.45] text-text-2">
            {description}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

function Saved({ message }: { message: string | null }) {
  return message ? (
    <p role="status" className="text-[13px] text-ok-text">
      {message}
    </p>
  ) : null;
}

/**
 * /dashboard/settings — the account: UpdateUser (name, email, password),
 * the account's public status page (GetStatusPage by owner id), and
 * DeleteUser.
 */
export default function SettingsPage() {
  const { user, saving, save, deleteAccount } = useAccountController();
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
      <div className="px-6 py-5">
        <Skeleton kind="panel-axis" style={{ height: 200 }} />
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
      setError(err instanceof Error ? err.message : "Saving failed.");
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

  return (
    <div
      className="flex max-w-[720px] flex-col gap-5 px-6 py-5"
      data-testid="settings"
    >
      <h1 className="text-[20px] font-semibold">Settings</h1>

      {error && (
        <p role="alert" className="text-[13px] text-crit-text">
          {error}
        </p>
      )}

      <Panel title="Profile">
        <form
          onSubmit={(e) => void saveProfile(e)}
          noValidate
          className="flex flex-col gap-4"
        >
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
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              Save profile
            </Button>
            <Saved message={profileMsg} />
          </div>
        </form>
      </Panel>

      <Panel
        title="Password"
        description="Sets the password for email sign-in. Accounts created with Google have none until one is set here."
      >
        <form
          onSubmit={(e) => void savePassword(e)}
          noValidate
          className="flex flex-col gap-4"
        >
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
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              Update password
            </Button>
            <Saved message={passwordMsg} />
          </div>
        </form>
      </Panel>

      <Panel
        title="Public status page"
        description="Every account has a public page listing all of its monitors and incidents. Anyone with the link can view it."
      >
        <Link
          href={statusPath}
          target="_blank"
          rel="noreferrer"
          className="font-data break-all text-[13px] text-brand-text hover:underline"
          data-testid="status-page-link"
        >
          {statusPath}
        </Link>
      </Panel>

      <Panel
        title="Delete account"
        description="Removes your account and signs you out."
      >
        <div>
          <Button kind="destructive" onClick={() => setConfirmDelete(true)}>
            Delete account
          </Button>
        </div>
      </Panel>

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
