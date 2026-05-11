import { emitSimulationStep } from "./world-events/emit";

export type RuntimeJobSnapshot = {
  queuedJobs: number;
  activeJob?: string;
  completedJobs: number;
  failedJobs: number;
};

export class NovelRuntimeWorker {
  private tail: Promise<void> = Promise.resolve();
  private queuedJobs = 0;
  private activeJob?: string;
  private completedJobs = 0;
  private failedJobs = 0;
  private stepCounter = 0;

  enqueue<T>(label: string, task: () => Promise<T>): Promise<T> {
    this.queuedJobs += 1;
    const stepIndex = ++this.stepCounter;
    emitSimulationStep({
      stepIndex,
      summary: `runtime queued: ${label}`,
    });
    const run = this.tail.then(async () => {
      this.queuedJobs -= 1;
      this.activeJob = label;
      emitSimulationStep({
        stepIndex,
        summary: `runtime active: ${label}`,
      });
      try {
        const result = await task();
        this.completedJobs += 1;
        return result;
      } catch (error) {
        this.failedJobs += 1;
        throw error;
      } finally {
        this.activeJob = undefined;
      }
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  snapshot(): RuntimeJobSnapshot {
    return {
      queuedJobs: this.queuedJobs,
      activeJob: this.activeJob,
      completedJobs: this.completedJobs,
      failedJobs: this.failedJobs,
    };
  }
}
