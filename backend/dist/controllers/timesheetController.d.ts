import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class TimesheetController {
    private static getTicketStatusForTimesheetStatus;
    private static validateRowsForUser;
    static createTimesheet(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    private static insertHistory;
    private static resetTimesheetToPending;
    private static getPendingChangeRequest;
    private static getLatestChangeRequest;
    private static getRowsForTable;
    private static replaceChangeRequestRows;
    private static upsertPendingChangeRequest;
    private static applyApprovedChangeRequest;
    static addTimesheetRow(timesheetId: number, row: {
        id?: number;
        employee_id: number;
        project_id: number;
        monday?: number;
        tuesday?: number;
        wednesday?: number;
        thursday?: number;
        friday?: number;
        saturday?: number;
        sunday?: number;
        sick_days?: string;
    }): Promise<void>;
    static recalculateWeeklyOT(weekStartDate: string): Promise<void>;
    static getTimesheets(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getTimesheetDetail(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static updateTimesheetRows(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static submitTimesheet(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static approveTimesheet(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static rejectTimesheet(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static deleteTimesheet(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static deleteTimesheetRow(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getTimesheetHistory(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    static getEmployeeHoursReport(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Admin alerts — projects without supervisors, employees without projects,
     * overdue pending timesheets, supervisors missing current week's timesheet
     */
    static getAdminAlerts(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
//# sourceMappingURL=timesheetController.d.ts.map