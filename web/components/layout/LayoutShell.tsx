"use client";
import MenuBar from "./menuBar/MenuBar";
import { usePathname } from "next/navigation";

const noMenuRoutes = ["/", "/login", "/signup"];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showMenu = !noMenuRoutes.includes(pathname);

  return (
    <main>
      {showMenu && <MenuBar />}
      <div className="content">{children}</div>
    </main>
  );
}