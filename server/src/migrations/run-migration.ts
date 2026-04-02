import { db } from '../db';
import fs from 'fs';
import path from 'path';

/**
 * Run database migration to add enhanced semantic fields
 */
export function runMigration001() {
  const migrationPath = path.join(__dirname, '001_add_enhanced_fields.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Running migration: 001_add_enhanced_fields.sql');

  try {
    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    db.transaction(() => {
      for (const statement of statements) {
        db.exec(statement);
      }
    })();

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  runMigration001();
}
