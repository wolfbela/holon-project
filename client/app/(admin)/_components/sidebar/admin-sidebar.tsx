'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  Ticket,
  Users,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { NotificationBell } from '@/components/notifications';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-500' },
  { href: '/tickets', label: 'Tickets', icon: Ticket, color: 'text-amber-500' },
  { href: '/team', label: 'Team', icon: Users, color: 'text-violet-500' },
] as const;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Sidebar side="left" collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-1">
          <Link
            href="/dashboard"
            className="text-base font-bold tracking-tight text-sidebar-foreground"
          >
            Agilite
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell ticketBasePath="/tickets" />
            {user && (
              <Avatar size="sm">
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      render={<Link href={item.href} />}
                    >
                      <item.icon className={`size-4 ${item.color}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              tooltip="Toggle theme"
            >
              {isDark ? (
                <Moon className="size-4" />
              ) : (
                <Sun className="size-4" />
              )}
              <span>Dark mode</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => logout()}
              tooltip="Log out"
            >
              <LogOut className="size-4" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
