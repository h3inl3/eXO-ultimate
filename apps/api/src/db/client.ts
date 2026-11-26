import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import * as schema from './schema.ts';

const envUrl = process.env.DATABASE_URL;
if (!envUrl) throw new Error('DATABASE_URL is not set (copy .env.example to .env)');
export const url = envUrl;

// On AWS the password lives in the RDS-managed secret, which rotates. Reading it for each
// new connection means rotation never needs a redeploy.
const secretArn = process.env.DB_SECRET_ARN;
const secrets = secretArn ? new SecretsManagerClient({}) : undefined;
async function secretPassword() {
  const { SecretString } = await secrets!.send(new GetSecretValueCommand({ SecretId: secretArn }));
  return JSON.parse(SecretString!).password as string;
}
export const connectionOptions = secretArn ? { password: secretPassword } : {};

export const sql = postgres(url, connectionOptions);
export const db = drizzle(sql, { schema });
export type Db = typeof db;
