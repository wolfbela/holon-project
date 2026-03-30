export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Customer navbar will be added by issue #22 */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
