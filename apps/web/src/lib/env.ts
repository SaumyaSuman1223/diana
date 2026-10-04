function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}; see .env.example`);
  return value;
}

// NEXT_PUBLIC_* must be referenced literally so Next can inline them in client bundles.
export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseKey = () =>
  required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export const databaseUrl = () => required("DATABASE_URL", process.env.DATABASE_URL);
