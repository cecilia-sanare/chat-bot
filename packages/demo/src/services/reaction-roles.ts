import { db, reaction_roles_table } from '../db';

export async function createReactionRoles(value: typeof reaction_roles_table.$inferSelect) {
  await db.insert(reaction_roles_table).values(value);
}
