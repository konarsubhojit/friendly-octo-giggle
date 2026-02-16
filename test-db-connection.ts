import 'dotenv/config';
import pg from 'pg';

async function testConnection() {
  console.log('Testing database connection...');
  
  const connectionString = process.env.DATABASE_URL || '';
  console.log('Connection string exists:', !!connectionString);
  
  const isSSL = !connectionString.includes('sslmode=disable') && !connectionString.includes('localhost');
  console.log('SSL enabled:', isSSL);
  
  const sslConfig = isSSL
    ? {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      }
    : false;
  
  const pool = new pg.Pool({
    connectionString,
    ssl: sslConfig,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
  
  try {
    const client = await pool.connect();
    console.log('✓ Database connection successful!');
    
    const result = await client.query('SELECT NOW()');
    console.log('✓ Query executed successfully:', result.rows[0]);
    
    client.release();
    await pool.end();
    console.log('✓ Connection closed');
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    await pool.end();
    return false;
  }
}

testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
