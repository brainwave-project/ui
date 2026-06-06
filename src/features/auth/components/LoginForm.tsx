import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Lock, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AICore } from '@/components/ai/AICore';
import { AuroraBackground } from '@/components/ai/AuroraBackground';
import { useLogin } from '../hooks/useLogin';

const schema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-y-auto px-4 py-8">
      <AuroraBackground />

      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Hero identity */}
        <div className="mb-6 flex flex-col items-center text-center">
          <AICore size={104} className="mb-3 animate-float" />
          <h1 className="font-display text-4xl font-bold tracking-tight neon-text text-glow">
            BRAINWAVE
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
            Neural Knowledge Engine
          </p>
        </div>

        <Card className="holo-border">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-xl">Access Terminal</CardTitle>
            <CardDescription>Authenticate to enter the workspace</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit((d) => login.mutate(d))} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Identity
                </Label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="e.g. dev-admin"
                    autoComplete="username"
                    className="pl-9"
                    {...register('username')}
                  />
                </div>
                {errors.username && (
                  <p className="text-xs text-destructive">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Passkey
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    className="pl-9"
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" variant="neon" className="w-full" disabled={login.isPending}>
                {login.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Establishing link…
                  </>
                ) : (
                  'Initialize Session'
                )}
              </Button>

              {login.isError && (
                <p className="text-center text-xs text-destructive">
                  Authentication failed. Verify your credentials.
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
          Encrypted · Local Inference · Zero External Calls
        </p>
      </div>
    </div>
  );
}
