/**
 * Layout.tsx
 */

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <main className="flex min-h-dvh flex-col bg-white text-black">
      {children}
    </main>
  );
}
