import type { ReportRepository } from "@/domain/report";
import { getIndexedDBRepository } from "./indexeddb-repository";
import { remoteRepository, getDispatcherKey } from "./remote-repository";

const local = getIndexedDBRepository();
const repository: ReportRepository = {
  async list() {
    const demos = (await local.list())
      .filter((report) => report.analysis.provider === "demo")
      .map((report) => ({ ...report, isDemo: true }));
    const real = getDispatcherKey() ? await remoteRepository.list() : [];
    return [...real, ...demos].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  },
  async get(id) {
    const demo = await local.get(id);
    return demo?.analysis.provider === "demo"
      ? { ...demo, isDemo: true }
      : remoteRepository.get(id);
  },
  async create(input, evidence) {
    return input.analysis.provider === "demo"
      ? local.create(input, evidence)
      : remoteRepository.create(input, evidence);
  },
  async updateStatus(id, status) {
    const demo = await local.get(id);
    return demo?.analysis.provider === "demo"
      ? local.updateStatus(id, status)
      : remoteRepository.updateStatus(id, status);
  },
  async getEvidence(id) {
    const demo = await local.get(id);
    return demo?.analysis.provider === "demo"
      ? local.getEvidence(id)
      : remoteRepository.getEvidence(id);
  },
};
export function getReportRepository(): ReportRepository {
  return repository;
}
