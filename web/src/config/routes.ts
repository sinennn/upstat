/**
 * App routes. Detail pages take their id as a query parameter, not a path
 * segment: the desktop app is a static export (no server to resolve
 * `/monitors/<any id>`), and a query string works identically in both the
 * web and desktop builds.
 */
export const routes = {
  monitor: (id: string) =>
    `/dashboard/monitors/view?id=${encodeURIComponent(id)}`,
  editMonitor: (id: string) =>
    `/dashboard/monitors/edit?id=${encodeURIComponent(id)}`,
  incident: (id: string) =>
    `/dashboard/incidents/view?id=${encodeURIComponent(id)}`,
};
