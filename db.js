import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

// A "pool" keeps several open connections to Postgres ready to go,
// instead of opening/closing a new connection on every query
// (which would be slow). Every query in this app borrows a
// connection from this pool, runs, and gives it back.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon (and most cloud Postgres hosts) require SSL but use a
  // self-signed-style cert chain, so we relax strict verification.
  ssl: { rejectUnauthorized: false }
})
