/**
 * Layout.tsx
 */

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <main className="flex min-h-screen flex-col bg-white text-black dark:bg-black dark:text-white">
      {children}
    </main>
  );
}
