export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Admin sidebar will be added by issue #23 */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
