import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from '@/router';
import { Toaster } from '@/components/shared/Toaster';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          30_000,   // 30 s
      retry:              1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
