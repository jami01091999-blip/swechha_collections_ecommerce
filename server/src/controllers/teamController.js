import * as team from '../services/teamService.js';
import { noStore } from '../utils/cache.js';

export async function list(req, res) {
  noStore(res);
  res.status(200).json({ team: await team.listTeam() });
}

export async function add(req, res) {
  noStore(res);
  res.status(201).json({ member: await team.addMember(req.body || {}) });
}

export async function changeRole(req, res) {
  noStore(res);
  res.status(200).json({ member: await team.changeRole(req.user, req.params.userId, req.body?.role) });
}

export async function remove(req, res) {
  noStore(res);
  await team.removeMember(req.user, req.params.userId);
  res.status(200).json({ removed: true });
}
