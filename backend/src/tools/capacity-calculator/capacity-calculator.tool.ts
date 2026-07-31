import { Injectable } from "@nestjs/common";
import { InternalTool } from "../interfaces/internal-tool.interface";
import {
  CAPACITY_CALCULATOR_TOOL_NAME,
  CapacityCalculatorInput,
  CapacityCalculatorOutput,
  capacityCalculatorInputSchema,
  capacityCalculatorOutputSchema
} from "./capacity-calculator.schema";

interface RatioShares {
  readShare: number;
  writeShare: number;
}

interface Metric {
  raw: number;
  display: string;
  unit: string;
}

@Injectable()
export class CapacityCalculatorTool implements InternalTool {
  readonly name = CAPACITY_CALCULATOR_TOOL_NAME;
  readonly description = "Deterministically calculates baseline traffic, bandwidth, and storage estimates.";
  readonly inputSchema = capacityCalculatorInputSchema;
  readonly outputSchema = capacityCalculatorOutputSchema;

  execute(input: unknown): CapacityCalculatorOutput {
    const parsedInput = capacityCalculatorInputSchema.parse(input);
    return this.calculate(parsedInput);
  }

  calculate(input: CapacityCalculatorInput): CapacityCalculatorOutput {
    const { readShare, writeShare } = this.parseReadWriteRatio(input.readWriteRatio);
    const dailyActiveUsers = input.monthlyActiveUsers * (input.dailyActiveUserPercentage / 100);
    const dailyRequests = dailyActiveUsers * input.requestsPerActiveUserPerDay;
    const averageRequestsPerSecond = dailyRequests / 86_400;
    const peakRequestsPerSecond = averageRequestsPerSecond * input.peakTrafficMultiplier;
    const readQps = peakRequestsPerSecond * readShare;
    const writeQps = peakRequestsPerSecond * writeShare;
    const dailyBandwidthBytes = dailyRequests * input.averagePayloadSizeBytes;
    const monthlyBandwidthBytes = dailyBandwidthBytes * 30;
    const monthlyStorageGrowthBytes = input.monthlyActiveUsers * input.dataCreatedPerUserBytes;
    const retainedStorageBytes = monthlyStorageGrowthBytes * (input.retentionPeriodDays / 30);

    return {
      toolName: CAPACITY_CALCULATOR_TOOL_NAME,
      inputs: input,
      results: {
        dailyActiveUsers: this.countMetric(dailyActiveUsers, "users"),
        averageRequestsPerSecond: this.rateMetric(averageRequestsPerSecond, "rps"),
        peakRequestsPerSecond: this.rateMetric(peakRequestsPerSecond, "rps"),
        readQps: this.rateMetric(readQps, "qps"),
        writeQps: this.rateMetric(writeQps, "qps"),
        dailyBandwidth: this.bytesMetric(dailyBandwidthBytes),
        monthlyBandwidth: this.bytesMetric(monthlyBandwidthBytes),
        monthlyStorageGrowth: this.bytesMetric(monthlyStorageGrowthBytes),
        retainedStorageEstimate: this.bytesMetric(retainedStorageBytes)
      },
      assumptions: [
        "A month is treated as 30 days for bandwidth and storage estimates.",
        "Average traffic is distributed evenly across a day before applying the peak multiplier.",
        "Read and write QPS are split from peak requests per second using the read/write ratio.",
        "Bandwidth uses average payload size for every request.",
        "Data created per user is treated as monthly storage growth."
      ],
      warnings: this.buildWarnings(input, dailyActiveUsers, writeShare)
    };
  }

  private parseReadWriteRatio(readWriteRatio: string): RatioShares {
    const [readPart = "0", writePart = "0"] = readWriteRatio.split(":");
    const readRatio = Number(readPart);
    const writeRatio = Number(writePart);
    const total = readRatio + writeRatio;

    return {
      readShare: total === 0 ? 0 : readRatio / total,
      writeShare: total === 0 ? 0 : writeRatio / total
    };
  }

  private buildWarnings(
    input: CapacityCalculatorInput,
    dailyActiveUsers: number,
    writeShare: number
  ): string[] {
    const warnings: string[] = [];

    if (dailyActiveUsers === 0) {
      warnings.push("Traffic inputs produce zero daily active users.");
    }

    if (input.requestsPerActiveUserPerDay === 0) {
      warnings.push("Requests per active user is zero, so request-rate estimates are zero.");
    }

    if (writeShare === 0) {
      warnings.push("The read/write ratio has no write share, so write QPS is zero.");
    }

    if (input.peakTrafficMultiplier > 10) {
      warnings.push("Peak traffic multiplier is high; verify expected burst behavior.");
    }

    if (input.retentionPeriodDays > 3650) {
      warnings.push("Retention period exceeds ten years; verify compliance and archival needs.");
    }

    return warnings;
  }

  private countMetric(value: number, unit: string): Metric {
    return {
      raw: value,
      display: `${this.formatNumber(value)} ${unit}`,
      unit
    };
  }

  private rateMetric(value: number, unit: string): Metric {
    return {
      raw: value,
      display: `${this.formatNumber(value)} ${unit}`,
      unit
    };
  }

  private bytesMetric(value: number): Metric {
    return {
      raw: value,
      display: this.formatBytes(value),
      unit: "bytes"
    };
  }

  private formatNumber(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: rounded >= 100 ? 0 : 2
    }).format(rounded);
  }

  private formatBytes(value: number): string {
    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    let currentValue = value;
    let unitIndex = 0;

    while (currentValue >= 1024 && unitIndex < units.length - 1) {
      currentValue /= 1024;
      unitIndex += 1;
    }

    return `${this.formatNumber(currentValue)} ${units[unitIndex]}`;
  }
}

