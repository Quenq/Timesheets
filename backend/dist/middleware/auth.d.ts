import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
        role: string;
    };
}
export declare function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function authorizeRole(role: string | string[]): (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function generateToken(id: number, email: string, role: string): string;
export declare function verifyToken(token: string): {
    id: number;
    email: string;
    role: string;
} | null;
//# sourceMappingURL=auth.d.ts.map