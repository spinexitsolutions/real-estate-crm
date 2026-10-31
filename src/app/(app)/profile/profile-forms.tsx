"use client";

import { useRef, useTransition } from "react";
import { Lock, UserRound } from "lucide-react";
import { toast } from "sonner";
import { changePassword, updateProfile } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

export function ProfileForms({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [p1, start1] = useTransition();
  const [p2, start2] = useTransition();
  const pwRef = useRef<HTMLFormElement>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><UserRound className="size-4 text-slate-400" /> Personal details</span>} />
        <form
          className="space-y-4 p-5"
          action={(fd) =>
            start1(async () => {
              const res = await updateProfile(fd);
              if (res.error) toast.error(res.error);
              else toast.success("Profile updated");
            })
          }
        >
          <Field label="Full name" required>
            <Input name="name" required defaultValue={name} />
          </Field>
          <Field label="Email" hint="Contact an administrator to change your email.">
            <Input value={email} disabled readOnly />
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={phone} placeholder="98200 00000" />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={p1}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Lock className="size-4 text-slate-400" /> Change password</span>} />
        <form
          ref={pwRef}
          className="space-y-4 p-5"
          action={(fd) =>
            start2(async () => {
              const res = await changePassword(fd);
              if (res.error) toast.error(res.error);
              else {
                toast.success("Password changed");
                pwRef.current?.reset();
              }
            })
          }
        >
          <Field label="Current password" required>
            <Input name="currentPassword" type="password" required autoComplete="current-password" />
          </Field>
          <Field label="New password" required hint="Minimum 8 characters">
            <Input name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" required>
            <Input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={p2}>
              Update password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
