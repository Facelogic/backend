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
