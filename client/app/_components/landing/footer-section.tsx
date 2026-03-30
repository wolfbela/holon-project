import Link from "next/link";

export function FooterSection() {
  return (
    <footer className="border-t px-4 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Holon</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer support, done right.
          </p>
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <Link href="/login" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
          <Link href="/register" className="transition-colors hover:text-foreground">
            Get started
          </Link>
        </div>
      </div>
    </footer>
  );
}
