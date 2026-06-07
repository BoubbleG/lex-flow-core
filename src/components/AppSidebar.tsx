import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Briefcase, Calendar, FileText, Settings, Scale } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Processos", url: "/processos", icon: Briefcase },
  { title: "Prazos & Tarefas", url: "/prazos", icon: Calendar },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => path === url || path.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <Scale className="h-5 w-5 text-sidebar-primary shrink-0" />
          {!collapsed && <span className="font-semibold text-sidebar-foreground">JusFlow</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
