import * as team from '../services/teamService.js';
import { audit } from '../services/auditService.js';
import { noStore } from '../utils/cache.js';

export async function list(req, res) {
  noStore(res);
  res.status(200).json({ team: await team.listTeam() });
}

export async function add(req, res) {
  noStore(res);
  const member = await team.addMember(req.body || {});
  await audit(req, 'team.add', { entity: 'user', entityId: member?._id, summary: `${member?.email} as ${member?.role}` });
  res.status(201).json({ member });
}

export async function changeRole(req, res) {
  noStore(res);
  const member = await team.changeRole(req.user, req.params.userId, req.body?.role);
  await audit(req, 'team.role', { entity: 'user', entityId: member?._id, summary: `${member?.email} → ${member?.role}` });
  res.status(200).json({ member });
}

export async function remove(req, res) {
  noStore(res);
  await team.removeMember(req.user, req.params.userId);
  await audit(req, 'team.remove', { entity: 'user', entityId: req.params.userId });
  res.status(200).json({ removed: true });
}
