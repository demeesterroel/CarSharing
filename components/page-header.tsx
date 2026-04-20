import { NavDrawer } from "./nav-drawer";

export function PageHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b sticky top-0 bg-white z-30">
      <NavDrawer />
      <h1 className="text-lg font-semibold flex-1">{title}</h1>
    </header>
  );
}
