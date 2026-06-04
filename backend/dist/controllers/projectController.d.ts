import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class ProjectController {
    private static canAccessProject;
    /**
     * Get all projects
     */
    static getProjects(req: AuthRequest, res: Response): Promise<void>;
    static getProjectSupervisors(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static addProjectSupervisor(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getProjectEmployees(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static addProjectEmployee(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static removeProjectEmployee(req: AuthRequest, res: Response): Promise<void>;
    static removeProjectSupervisor(req: AuthRequest, res: Response): Promise<void>;
    /**
     * Get project with financial summary
     */
    static getProjectSummary(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get all project summaries (for dashboard)
     */
    static getAllProjectSummaries(req: AuthRequest, res: Response): Promise<void>;
    /**
     * Build project summary object
     */
    static buildProjectSummary(projectId: number, project: any): Promise<{
        id: any;
        name: any;
        status: any;
        labor_budget: any;
        total_spent: number;
        overhead_amount: number;
        total_with_overhead: number;
        remaining: number;
        percent_spent: number;
        total_hours: number;
        ot_hours: number;
        ot_spent: number;
        current_week_hours: number;
        tickets_summary: {
            regular_tickets: number;
            ot_tickets: number;
            pending: number;
            approved: number;
        };
    }>;
    /**
     * Get current week hours for a project
     */
    static getCurrentWeekHours(projectId: number): Promise<number>;
    /**
     * Create new project (admin only)
     */
    static createProject(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Delete project (admin only)
     */
    static deleteProject(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Update project (admin only)
     */
    static updateProject(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
//# sourceMappingURL=projectController.d.ts.map