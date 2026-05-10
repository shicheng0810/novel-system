import { TimelineLine, cloneValue } from "./domain";

export class TruthKernel {
  private constructor(private readonly lines: Map<string, TimelineLine>) {}

  static fromCanon(canonLine: TimelineLine): TruthKernel {
    return new TruthKernel(new Map([[canonLine.lineId, cloneValue(canonLine)]]));
  }

  forkFromLine(line: TimelineLine): TruthKernel {
    const lines = new Map(this.lines);
    lines.set(line.lineId, cloneValue(line));
    return new TruthKernel(lines);
  }

  getLine(lineId: string): TimelineLine {
    const line = this.lines.get(lineId);
    if (!line) {
      throw new Error(`Unknown truth line: ${lineId}`);
    }
    return cloneValue(line);
  }
}

