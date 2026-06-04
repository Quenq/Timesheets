import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import ExcelJS from 'exceljs';
export declare class ExportController {
    /**
     * Export timesheets to Excel
     */
    static exportToExcel(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Create summary sheet
     */
    static createSummarySheet(workbook: ExcelJS.Workbook, weekStart: string, weekEnd: string, companyName?: string): Promise<void>;
    /**
     * Create project-specific sheet
     */
    static createProjectSheet(workbook: ExcelJS.Workbook, projectName: string, projectId: number, weekStart: string, weekEnd: string): Promise<void>;
    /**
     * Create all-projects sheet
     */
    static createAllProjectsSheet(workbook: ExcelJS.Workbook, weekStart: string, weekEnd: string): Promise<void>;
}
//# sourceMappingURL=exportController.d.ts.map