import type { AnalysisResult } from "./analysis";

export type ReportStatus = "NEW" | "IN_REVIEW" | "ACCEPTED" | "RESOLVED";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface VideoMetadata {
  name: string;
  size: number;
  type: string;
  duration: number;
  width: number;
  height: number;
}

export interface LeakReport {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ReportStatus;
  analysis: AnalysisResult;
  location: Coordinates;
  locationLabel: string;
  description: string;
  video: VideoMetadata | null;
  isDemo: boolean;
  evidenceId: string | null;
}

export interface CreateReportInput {
  analysis: AnalysisResult;
  location: Coordinates;
  locationLabel: string;
  description: string;
  video: VideoMetadata;
}

export interface ReportRepository {
  list(): Promise<LeakReport[]>;
  get(id: string): Promise<LeakReport | null>;
  create(input: CreateReportInput, evidence: Blob): Promise<LeakReport>;
  updateStatus(id: string, status: ReportStatus): Promise<LeakReport>;
  getEvidence(id: string): Promise<Blob | null>;
}
