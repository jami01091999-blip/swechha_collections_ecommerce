import { useState } from 'react';
import { AdminHeader, AdminNav } from '../../components/admin/AdminChrome';
import Icon from '../../components/shared/Icon';
import {
  Avatar,
  Button,
  Card,
  ConfirmSheet,
  Field,
  Input,
  PageContainer,
  Segmented,
  Skeleton,
  ToneChip,
  initials,
} from '../../components/ui';
import { addTeamMember, changeTeamRole, removeTeamMember, useAdminProducts, useTeam } from '../../lib/api';
import { isAdmin, useAuth } from '../../lib/auth';
import { useInventoryStats } from './Dashboard';
import { useToast } from '../../context/Toast';

const ROLES = [
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admin' },
];
const ROLE_HELP = 'Staff can manage products and stock. Admins can also edit the lookbook and the team.';

function AddMember() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setErr('Enter an email address.');
    setBusy(true);
    setErr('');
    try {
      const { member } = await addTeamMember(email, role);
      toast(`${member.email} added as ${role}`);
      setEmail('');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card as="form" onSubmit={submit} noValidate className="space-y-3">
      <div>
        <h2 className="font-headline-sm text-[18px] leading-tight text-primary">Add someone</h2>
        <p className="font-body-sm text-[12px] text-on-surface-variant mt-0.5">They sign in with this email and a code. {ROLE_HELP}</p>
      </div>
      <Field label="Email" htmlFor="team-email" error={err}>
        <Input
          id="team-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={!!err}
          placeholder="name@example.com"
        />
      </Field>
      <Segmented label="Role" value={role} options={ROLES} onChange={setRole} />
      <Button type="submit" disabled={busy} className="w-full md:w-auto md:px-8">
        {busy ? 'Adding…' : 'Add to team'}
      </Button>
    </Card>
  );
}

function MemberRow({ m, me, onRole, onRemove }) {
  const self = m._id === me._id;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 flex items-center justify-between gap-3 shadow-luxury-subtle">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="shrink-0">{initials(m)}</Avatar>
        <div className="min-w-0 space-y-1">
          <p className="font-title-md text-[15px] text-primary leading-tight truncate">{m.name || m.email}</p>
          {m.name && <p className="font-body-sm text-[12px] text-on-surface-variant truncate">{m.email}</p>}
          <div className="flex flex-wrap gap-1">
            <ToneChip tone={m.role === 'admin' ? 'amber' : 'grey'}>{m.role === 'admin' ? 'Admin' : 'Staff'}</ToneChip>
            {self && <ToneChip tone="green">You</ToneChip>}
            {!m.lastLoginAt && <ToneChip tone="grey">Not signed in yet</ToneChip>}
          </div>
        </div>
      </div>
      {!self && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={onRole}>
            {m.role === 'admin' ? 'Make staff' : 'Make admin'}
          </Button>
          <button type="button" onClick={onRemove} className="font-label-lg text-label-lg text-error underline">
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

export default function Team() {
  const toast = useToast();
  const { user } = useAuth();
  const allowed = isAdmin(user);
  const { data: products } = useAdminProducts();
  const stats = useInventoryStats(products);
  const { data: team, loading, error, reload } = useTeam(allowed);
  const [confirm, setConfirm] = useState(null); // { kind: 'role' | 'remove', member }
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const { kind, member } = confirm;
    setBusy(true);
    try {
      if (kind === 'remove') {
        await removeTeamMember(member._id);
        toast(`${member.email} removed from the team`);
      } else {
        const role = member.role === 'admin' ? 'staff' : 'admin';
        await changeTeamRole(member._id, role);
        toast(`${member.email} is now ${role}`);
      }
      setConfirm(null);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminHeader alerts={stats.attention.length} />
      <PageContainer as="main" className="px-gutter-mobile pt-3 md:pt-6 pb-8 space-y-4">
        <div>
          <h2 className="font-headline-sm text-headline-sm md:text-headline-md text-primary">Team</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant -mt-0.5">People who can open this admin</p>
        </div>
        {!allowed ? (
          <Card className="text-center py-8">
            <Icon name="lock" className="text-3xl text-outline" />
            <p className="font-title-md text-[15px] text-primary mt-1">Only admins can manage the team</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Ask an admin if someone needs access.</p>
          </Card>
        ) : (
          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-5 md:items-start">
            <AddMember />
            <section className="space-y-2">
              {error && !team ? (
                <Card className="text-center">
                  <p className="font-body-sm text-body-sm text-on-surface">{error.message}</p>
                  <Button variant="ghost" size="sm" onClick={reload} className="mt-2">
                    Try again
                  </Button>
                </Card>
              ) : loading && !team ? (
                [0, 1].map((i) => <Skeleton key={i} tone="lowest" className="h-[76px] rounded-xl border border-outline-variant/40" />)
              ) : team.length > 1 ? (
                team.map((m) => (
                  <MemberRow
                    key={m._id}
                    m={m}
                    me={user}
                    onRole={() => setConfirm({ kind: 'role', member: m })}
                    onRemove={() => setConfirm({ kind: 'remove', member: m })}
                  />
                ))
              ) : (
                <>
                  {team.map((m) => (
                    <MemberRow key={m._id} m={m} me={user} />
                  ))}
                  <p className="font-body-sm text-body-sm text-on-surface-variant px-0.5">
                    It's just you so far. Add staff above when you need help.
                  </p>
                </>
              )}
            </section>
          </div>
        )}
      </PageContainer>
      <AdminNav />
      {confirm && (
        <ConfirmSheet
          title={
            confirm.kind === 'remove'
              ? `Remove ${confirm.member.email}?`
              : `Make ${confirm.member.email} ${confirm.member.role === 'admin' ? 'staff' : 'an admin'}?`
          }
          body={
            confirm.kind === 'remove'
              ? 'They keep their customer account but can no longer open the admin.'
              : confirm.member.role === 'admin'
                ? 'They will no longer be able to edit the lookbook or the team.'
                : 'They will be able to edit the lookbook and manage the team.'
          }
          confirmLabel={confirm.kind === 'remove' ? 'Remove' : 'Change role'}
          busy={busy}
          onConfirm={run}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
