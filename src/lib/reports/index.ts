import type { ReportRepository } from "@/domain/report";
import { getIndexedDBRepository } from "./indexeddb-repository";
import { remoteRepository, getDispatcherKey } from "./remote-repository";

const repository: ReportRepository = {
  async list() {
    return getDispatcherKey() ? remoteRepository.list() : [];
  },
  async get(id) {
    return remoteRepository.get(id);
  },
  async create(input, evidence) {
    return input.analysis.provider === "demo"
      ? getIndexedDBRepository().create(input, evidence)
      : remoteRepository.create(input, evidence);
  },
  async updateStatus(id, status) {
    return remoteRepository.updateStatus(id, status);
  },
  async getEvidence(id) {
    return remoteRepository.getEvidence(id);
  },
};
export function getReportRepository(): ReportRepository {
  return repository;
}
