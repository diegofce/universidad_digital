import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Field } from '../../components/forms/Field';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { AuthLayout } from '../../layouts/AuthLayout';
import { getErrorMessage } from '../../utils/errors';
const schema = z.object({
  email: z.string().email('Introduce un email válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});
type FormData = z.infer<typeof schema>;
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });
  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      await login(data.email, data.password);
      const destination = (location.state as { from?: string } | null)?.from ?? '/dashboard';
      navigate(destination, { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error, 'Email o contraseña incorrectos.'));
    }
  };
  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="login-title">
        <p className="muted">PLATAFORMA ACADÉMICA</p>
        <h1 id="login-title">Universidad Digital</h1>
        <p className="muted">Accede a tu espacio de gestión.</p>
        {serverError && (
          <p className="alert" role="alert">
            {serverError}
          </p>
        )}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field
            label="Email"
            type="email"
            autoComplete="username"
            {...register('email')}
            error={errors.email?.message}
          />
          <Field
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            error={errors.password?.message}
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Validando...' : 'Iniciar sesión'}
          </Button>
        </form>
      </section>
    </AuthLayout>
  );
}
