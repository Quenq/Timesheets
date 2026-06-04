import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class AuthController {
    static login(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static register(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static me(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getSupervisors(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static createSupervisor(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static updateSupervisor(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static toggleSupervisorActive(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
//# sourceMappingURL=authController.d.ts.map