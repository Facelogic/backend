import { Menu, MenuRole } from '../../db/models/index.ts';
import HttpError from '../../utils/http-error.ts';

const PROVIDER_PREFIX = '/proveedor/';

export type MenuArea = 'provider' | 'school';

export interface MenuItem {
  id: string;
  code: string;
  name: string;
  title: string;
  description: string | null;
  path: string;
  // Area of the frontend the page belongs to, from its path (/proveedor/... or /colegio/:slug/...).
  area: MenuArea;
  // Last segment of the path, what the frontend checks to allow a page ("colegios", "sin-recoger").
  section: string;
}

function toItem(menu: InstanceType<typeof Menu>): MenuItem {
  const { id, code, name, title, description, path } = menu;
  return {
    id,
    code,
    name,
    title,
    description: description ?? null,
    path,
    area: path.startsWith(PROVIDER_PREFIX) ? 'provider' : 'school',
    section: path.split('/').filter(Boolean).at(-1) ?? path,
  };
}

// Active menu items assigned to a role through "MenuRole".
export async function listForRole(roleId: string | null | undefined): Promise<MenuItem[]> {
  if (!roleId) throw new HttpError(403, 'The account has no role assigned');

  const links = await MenuRole.findAll({
    where: { roleId },
    include: [{ model: Menu, as: 'menu', required: true, where: { status: 1 } }],
    order: [[{ model: Menu, as: 'menu' }, 'path', 'ASC']],
  });

  // Dedupe in case the same menu was linked twice to the role ("MenuRole" has no unique constraint).
  const byId = new Map<string, MenuItem>();
  for (const link of links) {
    if (link.menu && !byId.has(link.menu.id)) byId.set(link.menu.id, toItem(link.menu));
  }
  return [...byId.values()];
}
