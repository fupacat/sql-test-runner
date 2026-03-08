import * as sql from 'mssql';

export interface SqlConnectionConfig {
    connectionString: string;
}

/**
 * Manages a persistent connection pool to SQL Server.
 * Wraps the mssql library and provides a simple query interface.
 */
export class SqlConnectionManager {
    private pool: sql.ConnectionPool | null = null;
    private connectionString: string;

    constructor(connectionString: string) {
        this.connectionString = connectionString;
    }

    async connect(): Promise<void> {
        if (this.pool && this.pool.connected) {
            return;
        }
        this.pool = await sql.connect(this.connectionString);
    }

    async disconnect(): Promise<void> {
        if (this.pool) {
            await this.pool.close();
            this.pool = null;
        }
    }

    async query<T = sql.IRecordSet<Record<string, unknown>>>(
        queryText: string,
        params?: Record<string, unknown>
    ): Promise<T> {
        await this.connect();
        const request = this.pool!.request();
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                request.input(key, value);
            }
        }
        const result = await request.query(queryText);
        return result.recordset as unknown as T;
    }

    async isConnected(): Promise<boolean> {
        try {
            await this.connect();
            await this.query('SELECT 1 AS ping');
            return true;
        } catch {
            return false;
        }
    }

    updateConnectionString(connectionString: string): void {
        this.connectionString = connectionString;
        if (this.pool) {
            this.pool.close();
            this.pool = null;
        }
    }
}
