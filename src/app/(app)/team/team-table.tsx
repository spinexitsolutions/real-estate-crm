"use client";

import { useState, useTransition } from "react";
import { Ellipsis, Mail, Pencil, Phone, Power, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { saveMember, setMemberActive } from "@/actions/team";
import { Avatar } from "@/components/ui/avatar";
import { Badge, OptionBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/charts";
import { ROLES } from "@/lib/constants";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  active: boolean;
  monthlyTarget: number;
  openLeads: number;
  wonThisMonth: number;
  revenueThisMonth: number;
};

export function TeamTable({ members, currentUserId, canEdit, currency }: { members: TeamMember[]; currentUserId: string; canEdit: boolean; currency: string }) {
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState<TeamMember | null>(null);
  const [pending, start] = useTransition();

  const reactivate = (m: TeamMember) =>
    start(async () => {
      const res = await setMemberActive(m.id, true);
      if (res.error) toast.error(res.error);
      else toast.success(`${m.name} is active again`);
    });

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Members</h3>
            <p className="text-[13px] text-slate-500">Performance figures are for the current month.</p>
          </div>
          {canEdit && (
            <Button onClick={() => setCreating(true)}>
              <UserPlus /> Add member
            </Button>
          )}
        </div>
        {members.length === 0 ? (
          <EmptyState icon={Users} title="No team members yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  <th className="table-th">Member</th>
                  <th className="table-th">Role</th>
                  <th className="table-th">Contact</th>
                  <th className="table-th text-right">Open leads</th>
                  <th className="table-th text-right">Won (month)</th>
                  <th className="table-th text-right">Revenue (month)</th>
                  <th className="table-th min-w-52">Target progress</th>
                  <th className="table-th">Status</th>
                  {canEdit && <th className="table-th w-12" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const pct = m.monthlyTarget > 0 ? Math.round((m.revenueThisMonth / m.monthlyTarget) * 100) : null;
                  return (
                    <tr key={m.id} className={cn("hover:bg-slate-50/60", !m.active && "opacity-60")}>
                      <td className="table-td">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.name} />
                          <div>
                            <p className="font-medium text-slate-900">
                              {m.name}
                              {m.id === currentUserId && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}
                            </p>
                            <p className="text-xs text-slate-500">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-td">
                        <OptionBadge list={ROLES} value={m.role} />
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-1">
                          {m.phone && (
                            <a href={`tel:${m.phone}`} title={m.phone} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                              <Phone className="size-4" />
                            </a>
                          )}
                          <a href={`mailto:${m.email}`} title={m.email} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                            <Mail className="size-4" />
                          </a>
                          {m.phone && <span className="text-xs text-slate-500">{m.phone}</span>}
                        </div>
                      </td>
                      <td className="table-td text-right">{m.openLeads}</td>
                      <td className="table-td text-right">{m.wonThisMonth}</td>
                      <td className="table-td text-right font-medium text-slate-900">{formatCompact(m.revenueThisMonth, currency)}</td>
                      <td className="table-td">
                        {pct === null ? (
                          <span className="text-xs text-slate-400">No target set</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <ProgressBar value={pct} className="flex-1" />
                            <span className="w-24 text-right text-xs text-slate-500">
                              <span className="font-semibold text-slate-800">{pct}%</span> of {formatCompact(m.monthlyTarget, currency)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="table-td">
                        {m.active ? (
                          <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20" dot="bg-emerald-500">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600 ring-slate-500/20" dot="bg-slate-400">
                            Inactive
                          </Badge>
                        )}
                      </td>
                      {canEdit && (
                        <td className="table-td">
                          <Dropdown
                            trigger={({ toggle }) => (
                              <button onClick={toggle} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Actions">
                                <Ellipsis className="size-4" />
                              </button>
                            )}
                          >
                            {(close) => (
                              <>
                                <DropdownItem
                                  icon={Pencil}
                                  onClick={() => {
                                    close();
                                    setEditing(m);
                                  }}
                                >
                                  Edit member
                                </DropdownItem>
                                {m.id !== currentUserId &&
                                  (m.active ? (
                                    <DropdownItem
                                      icon={Power}
                                      danger
                                      onClick={() => {
                                        close();
                                        setDeactivating(m);
                                      }}
                                    >
                                      Deactivate
                                    </DropdownItem>
                                  ) : (
                                    <DropdownItem
                                      icon={Power}
                                      onClick={() => {
                                        close();
                                        reactivate(m);
                                      }}
                                    >
                                      {pending ? "Activating..." : "Reactivate"}
                                    </DropdownItem>
                                  ))}
                              </>
                            )}
                          </Dropdown>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <MemberModal
          key={editing?.id ?? "new"}
          member={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {deactivating && (
        <DeactivateModal member={deactivating} others={members.filter((x) => x.active && x.id !== deactivating.id)} onClose={() => setDeactivating(null)} />
      )}
    </>
  );
}

function MemberModal({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = (fd: FormData) =>
    start(async () => {
      const res = await saveMember(member?.id ?? null, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(member ? "Member updated" : "Member added");
      onClose();
    });

  return (
    <Modal
      open
      onClose={() => !pending && onClose()}
      title={member ? "Edit member" : "Add team member"}
      description={member ? member.email : "They can sign in with this email and password."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="member-form" loading={pending}>
            {member ? "Save changes" : "Add member"}
          </Button>
        </>
      }
    >
      <form id="member-form" action={submit} className="grid gap-4 sm:grid-cols-2">
        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">{error}</p>}
        <Field label="Full name" required className="sm:col-span-2">
          <Input name="name" required defaultValue={member?.name} placeholder="e.g. Rohan Mehta" />
        </Field>
        <Field label="Email" required>
          <Input name="email" type="email" required defaultValue={member?.email} placeholder="name@company.com" />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={member?.phone ?? ""} placeholder="98200 00000" />
        </Field>
        <Field label="Role" required>
          <Select name="role" options={ROLES} defaultValue={member?.role ?? "AGENT"} />
        </Field>
        <Field label="Monthly revenue target" hint="Used for target progress in reports">
          <Input name="monthlyTarget" type="number" min={0} step="any" defaultValue={member?.monthlyTarget || ""} placeholder="2500000" />
        </Field>
        <Field label={member ? "Reset password" : "Password"} required={!member} hint={member ? "Leave blank to keep the current password" : "Minimum 8 characters"} className="sm:col-span-2">
          <Input name="password" type="password" minLength={8} required={!member} autoComplete="new-password" />
        </Field>
        <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 sm:col-span-2">
          <span className="font-medium text-slate-700">Roles:</span> Admins manage everything including settings. Managers see all leads and the team.
          Agents only see leads, follow-ups and deals assigned to them.
        </div>
      </form>
    </Modal>
  );
}

function DeactivateModal({ member, others, onClose }: { member: TeamMember; others: TeamMember[]; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const [reassign, setReassign] = useState(member.openLeads > 0);
  return (
    <Modal
      open
      size="sm"
      onClose={() => !pending && onClose()}
      title={`Deactivate ${member.name}?`}
      description="They will no longer be able to sign in. Their history is kept."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await setMemberActive(member.id, false, reassign ? target : null);
                if (res.error) {
                  toast.error(res.error);
                  return;
                }
                toast.success(`${member.name} has been deactivated`);
                onClose();
              })
            }
          >
            Deactivate
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {member.name} has <span className="font-semibold text-slate-900">{member.openLeads}</span> open lead{member.openLeads === 1 ? "" : "s"}.
        </p>
        <label className="flex items-start gap-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={reassign} onChange={(e) => setReassign(e.target.checked)} className="mt-0.5 size-4 rounded border-slate-300 accent-brand-600" />
          Reassign open leads and pending follow-ups
        </label>
        {reassign && (
          <Field label="Reassign to">
            <Select value={target} onChange={(e) => setTarget(e.target.value)} options={others.map((o) => ({ value: o.id, label: o.name }))} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
