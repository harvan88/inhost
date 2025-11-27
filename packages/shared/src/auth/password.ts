/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "packages/shared/src/auth/password.ts"
 *   type: "utility"
 *   layer: "shared"
 *   domain: "auth"
 *   purpose: "Utilidades de hashing de contraseñas usando Bun.password (bcrypt interno con cost=10). Exporta hashPassword (async), verifyPassword (async) y validatePasswordStrength (sync con reglas: min 8 chars, uppercase, lowercase, number). Sin dependencias externas ya que usa built-in de Bun"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: []
 *   infrastructure: ["Bun.password (bcrypt built-in)"]
 *
 * CONTRACTS:
 *   exports: ["hashPassword", "verifyPassword", "validatePasswordStrength"]
 *   inputs: ["password: string", "hash: string"]
 *   outputs: ["Promise<string> (hashed password)", "Promise<boolean> (verification result)", "{ valid: boolean, errors: string[] }"]
 *   errors: []
 *
 * INTEGRATION:
 *   data_flow: "[signup] → [validatePasswordStrength] → [hashPassword with bcrypt cost=10] → [store in adminUsers.passwordHash] → [login] → [verifyPassword(plaintext, hash)] → [boolean result]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["routes/admin/auth.ts (signup, login)"]
 *   uses: []
 *   critical: true
 *
 * === DOC_END :: password.ts ===
 */

/**
 * Password Hashing Utilities
 *
 * Uses Bun's built-in password hashing (based on bcrypt)
 * for secure password storage and verification.
 */

/**
 * Hash a plain text password
 * @param password - Plain text password to hash
 * @returns Promise<string> - Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: 10, // bcrypt cost factor (10 is a good balance)
  });
}

/**
 * Verify a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Hashed password to compare against
 * @returns Promise<boolean> - True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Object with validation result and errors
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
