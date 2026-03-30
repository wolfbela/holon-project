'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEffect, useState } from 'react';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!user) return null;

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <Avatar size="sm">
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem
            checked={isDark}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
          >
            {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
            Dark mode
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={() => logout()}>
            <LogOut className="size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
