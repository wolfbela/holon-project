import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { cn } from '@/lib/utils';

// ─── cn() utility ────────────────────────────────────────────────

describe('cn() utility', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('should handle undefined and null values', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end');
  });

  it('should merge conflicting Tailwind classes (last wins)', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
  });

  it('should merge complex Tailwind class conflicts', () => {
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('should handle empty inputs', () => {
    expect(cn()).toBe('');
  });

  it('should handle array inputs via clsx', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('should handle object inputs via clsx', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });
});

// ─── Component imports ───────────────────────────────────────────

describe('shadcn/ui component imports', () => {
  it('should import Button component', () => {
    const { Button } = require('@/components/ui/button');
    expect(Button).toBeDefined();
  });

  it('should import Input component', () => {
    const { Input } = require('@/components/ui/input');
    expect(Input).toBeDefined();
  });

  it('should import Textarea component', () => {
    const { Textarea } = require('@/components/ui/textarea');
    expect(Textarea).toBeDefined();
  });

  it('should import Card components', () => {
    const {
      Card,
      CardHeader,
      CardFooter,
      CardTitle,
      CardDescription,
      CardContent,
    } = require('@/components/ui/card');
    expect(Card).toBeDefined();
    expect(CardHeader).toBeDefined();
    expect(CardFooter).toBeDefined();
    expect(CardTitle).toBeDefined();
    expect(CardDescription).toBeDefined();
    expect(CardContent).toBeDefined();
  });

  it('should import Table components', () => {
    const {
      Table,
      TableHeader,
      TableBody,
      TableFooter,
      TableHead,
      TableRow,
      TableCell,
      TableCaption,
    } = require('@/components/ui/table');
    expect(Table).toBeDefined();
    expect(TableHeader).toBeDefined();
    expect(TableBody).toBeDefined();
    expect(TableFooter).toBeDefined();
    expect(TableHead).toBeDefined();
    expect(TableRow).toBeDefined();
    expect(TableCell).toBeDefined();
    expect(TableCaption).toBeDefined();
  });

  it('should import Dialog components', () => {
    const {
      Dialog,
      DialogTrigger,
      DialogContent,
      DialogHeader,
      DialogFooter,
      DialogTitle,
      DialogDescription,
    } = require('@/components/ui/dialog');
    expect(Dialog).toBeDefined();
    expect(DialogTrigger).toBeDefined();
    expect(DialogContent).toBeDefined();
    expect(DialogHeader).toBeDefined();
    expect(DialogFooter).toBeDefined();
    expect(DialogTitle).toBeDefined();
    expect(DialogDescription).toBeDefined();
  });

  it('should import Skeleton component', () => {
    const { Skeleton } = require('@/components/ui/skeleton');
    expect(Skeleton).toBeDefined();
  });

  it('should import Badge component', () => {
    const { Badge } = require('@/components/ui/badge');
    expect(Badge).toBeDefined();
  });

  it('should import Avatar components', () => {
    const {
      Avatar,
      AvatarImage,
      AvatarFallback,
    } = require('@/components/ui/avatar');
    expect(Avatar).toBeDefined();
    expect(AvatarImage).toBeDefined();
    expect(AvatarFallback).toBeDefined();
  });

  it('should import DropdownMenu components', () => {
    const {
      DropdownMenu,
      DropdownMenuTrigger,
      DropdownMenuContent,
      DropdownMenuItem,
    } = require('@/components/ui/dropdown-menu');
    expect(DropdownMenu).toBeDefined();
    expect(DropdownMenuTrigger).toBeDefined();
    expect(DropdownMenuContent).toBeDefined();
    expect(DropdownMenuItem).toBeDefined();
  });

  it('should import Label component', () => {
    const { Label } = require('@/components/ui/label');
    expect(Label).toBeDefined();
  });

  it('should import Select components', () => {
    const {
      Select,
      SelectTrigger,
      SelectContent,
      SelectItem,
      SelectValue,
    } = require('@/components/ui/select');
    expect(Select).toBeDefined();
    expect(SelectTrigger).toBeDefined();
    expect(SelectContent).toBeDefined();
    expect(SelectItem).toBeDefined();
    expect(SelectValue).toBeDefined();
  });

  it('should import Toaster (sonner) component', () => {
    const { Toaster } = require('@/components/ui/sonner');
    expect(Toaster).toBeDefined();
  });
});

// ─── Component rendering ─────────────────────────────────────────

describe('shadcn/ui component rendering', () => {
  it('should render Button with text', () => {
    const { Button } = require('@/components/ui/button');
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole('button', { name: 'Click me' }),
    ).toBeInTheDocument();
  });

  it('should render Button with variant classes', () => {
    const { Button } = require('@/components/ui/button');
    const { container } = render(<Button variant="destructive">Delete</Button>);
    const button = container.querySelector('button');
    expect(button).toBeInTheDocument();
    expect(button?.textContent).toBe('Delete');
  });

  it('should render Input with placeholder', () => {
    const { Input } = require('@/components/ui/input');
    render(<Input placeholder="Enter email" />);
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
  });

  it('should render Textarea with placeholder', () => {
    const { Textarea } = require('@/components/ui/textarea');
    render(<Textarea placeholder="Enter message" />);
    expect(screen.getByPlaceholderText('Enter message')).toBeInTheDocument();
  });

  it('should render Card with content', () => {
    const {
      Card,
      CardHeader,
      CardTitle,
      CardContent,
    } = require('@/components/ui/card');
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent>Card body</CardContent>
      </Card>,
    );
    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Card body')).toBeInTheDocument();
  });

  it('should render Table with rows', () => {
    const {
      Table,
      TableHeader,
      TableBody,
      TableRow,
      TableHead,
      TableCell,
    } = require('@/components/ui/table');
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>John</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('John')).toBeInTheDocument();
  });

  it('should render Skeleton', () => {
    const { Skeleton } = require('@/components/ui/skeleton');
    const { container } = render(<Skeleton className="h-4 w-32" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render Badge with text', () => {
    const { Badge } = require('@/components/ui/badge');
    render(<Badge>Open</Badge>);
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('should render Badge with variant', () => {
    const { Badge } = require('@/components/ui/badge');
    render(<Badge variant="secondary">Closed</Badge>);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('should render Label with text', () => {
    const { Label } = require('@/components/ui/label');
    render(<Label>Email</Label>);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('should render Avatar with fallback', () => {
    const { Avatar, AvatarFallback } = require('@/components/ui/avatar');
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('JD')).toBeInTheDocument();
  });
});

// ─── ThemeProvider ────────────────────────────────────────────────

describe('ThemeProvider', () => {
  it('should render children', () => {
    const { ThemeProvider } = require('@/components/theme-provider');
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <div>Theme content</div>
      </ThemeProvider>,
    );
    expect(screen.getByText('Theme content')).toBeInTheDocument();
  });

  it('should accept defaultTheme prop without error', () => {
    const { ThemeProvider } = require('@/components/theme-provider');
    expect(() => {
      render(
        <ThemeProvider attribute="class" defaultTheme="light">
          <span>Light mode</span>
        </ThemeProvider>,
      );
    }).not.toThrow();
  });

  it('should accept dark defaultTheme prop without error', () => {
    const { ThemeProvider } = require('@/components/theme-provider');
    expect(() => {
      render(
        <ThemeProvider attribute="class" defaultTheme="dark">
          <span>Dark mode</span>
        </ThemeProvider>,
      );
    }).not.toThrow();
  });
});
