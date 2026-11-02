export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateProductionReadiness } = await import('./core/config/env-validator');
    validateProductionReadiness();
  }
}
