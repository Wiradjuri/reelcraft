import { ArrowRight } from 'lucide-react'
import * as React from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'

import { ErrorNotice } from '@/components/ErrorNotice'
import { FullPageLoader } from '@/components/layout/FullPageLoader'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useLogin, useSetupStatus } from '@/lib/api/hooks'

export default function LoginPage() {
  const { data: status, isPending } = useSetupStatus()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')

  if (isPending) return <FullPageLoader />
  if (status?.needs_account) return <Navigate to="/setup" replace />
  if (status?.authenticated) return <Navigate to="/" replace />

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="animate-rise w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <Logo />
        </div>
        <div className="border-line bg-surface shadow-card rounded-xl border p-7">
          <h1 className="font-display text-[32px] leading-tight">Welcome back</h1>
          <p className="text-muted mb-6 text-[14px]">Sign in to your content studio.</p>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              login.mutate({ email, password }, { onSuccess: () => navigate(from, { replace: true }) })
            }}
          >
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            {login.isError && <ErrorNotice error={login.error} />}
            <Button type="submit" size="lg" loading={login.isPending} className="mt-1 w-full">
              Sign in <ArrowRight />
            </Button>
          </form>
        </div>
        {status?.signup_allowed && (
          <p className="text-muted mt-6 text-center text-[14px]">
            New to ReelCraft?{' '}
            <Link to="/setup" className="text-ember-ink font-medium hover:underline">
              Create an account
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
