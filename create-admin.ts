import { pool } from '@inhost/shared';

async function createAdmin() {
  console.log('👤 Creating admin user...');
  
  try {
    // Primero verificar si ya existe
    const existingUser = await pool.query(
      'SELECT id FROM admin_users WHERE email = $1',
      ['admin@test.com']
    );
    
    if (existingUser.rows.length > 0) {
      console.log('✅ Admin user already exists');
      return;
    }
    
    // Crear tenant por defecto si no existe
    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE slug = $1',
      ['default']
    );
    
    let tenantId;
    if (tenantResult.rows.length === 0) {
      const newTenant = await pool.query(`
        INSERT INTO tenants (id, name, slug, plan, settings, created_at, updated_at)
        VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Default Tenant', 'default', 'starter', '{}', NOW(), NOW())
        RETURNING id
      `);
      tenantId = newTenant.rows[0].id;
      console.log('✅ Default tenant created');
    } else {
      tenantId = tenantResult.rows[0].id;
      console.log('✅ Default tenant exists');
    }
    
    // Crear usuario admin con hash simple (solo para desarrollo)
    const hashedPassword = 'hashed_password123'; // En producción usar bcrypt
    
    const result = await pool.query(`
      INSERT INTO admin_users (tenant_id, email, password_hash, name, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'admin', NOW(), NOW())
      RETURNING id, email
    `, [tenantId, 'admin@test.com', hashedPassword, 'Admin User']);
    
    console.log('✅ Admin user created:', result.rows[0]);
    
  } catch (error) {
    console.error('❌ Error creating admin:', error);
  } finally {
    await pool.end();
  }
}

createAdmin().catch(console.error);
