export declare function initDatabase(): Promise<void>;
export declare function runRaw(sql: string): void;
export declare function runSchema(sql: string): void;
declare const pool: {
    query: (sql: string, params?: any[]) => Promise<{
        rows: any[];
    }>;
};
export default pool;
//# sourceMappingURL=connection.d.ts.map