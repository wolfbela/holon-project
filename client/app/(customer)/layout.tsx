import { CustomerNavbar } from './_components/navbar/customer-navbar';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <CustomerNavbar />
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
