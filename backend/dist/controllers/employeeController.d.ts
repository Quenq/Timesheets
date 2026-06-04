import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class EmployeeController {
    static getEmployees(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static createEmployee(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static updateEmployee(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static deleteEmployee(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static toggleEmployeeActive(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
//# sourceMappingURL=employeeController.d.ts.map