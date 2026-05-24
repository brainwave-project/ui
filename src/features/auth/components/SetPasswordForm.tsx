import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'react-router-dom';
import { Brain, Lock, Loader2 } from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSetPassword } from '../hooks/useSetPassword';

const schema = z
  .object({
    new_password:     z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path:    ['confirm_password'],
  });

type FormData = z.infer<typeof schema>;

export function SetPasswordForm() {
  const [params]   = useSearchParams();
  const username   = params.get('username') ?? '';
  const mutation   = useSetPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function onSubmit(data: FormData) {
    mutation.mutate({ username, new_password: data.new_password });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <Brain className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Set Your Password</CardTitle>
          <CardDescription>
            Your account requires a new password before you can continue.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {username && (
            <p className="mb-4 rounded-md bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
              Signing in as{' '}
              <span className="font-medium text-foreground">{username}</span>
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                {...register('new_password')}
              />
              {errors.new_password && (
                <p className="text-xs text-destructive">{errors.new_password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                {...register('confirm_password')}
              />
              {errors.confirm_password && (
                <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting password…
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Set Password &amp; Sign In
                </>
              )}
            </Button>

            {mutation.isError && (
              <p className="text-center text-xs text-destructive">
                Failed to set password. Please try again.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
