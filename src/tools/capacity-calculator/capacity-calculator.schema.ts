import { z } from "zod";

export const CAPACITY_CALCULATOR_TOOL_NAME = "capacity-calculator";

export const capacityCalculatorInputSchema = z
  .object({
    monthlyActiveUsers: z.number().finite().nonnegative(),
    dailyActiveUserPercentage: z.number().finite().min(0).max(100).default(20),
    requestsPerActiveUserPerDay: z.number().finite().nonnegative().default(20),
    readWriteRatio: z
      .string()
      .regex(/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/)
      .default("80:20"),
    averagePayloadSizeBytes: z.number().finite().nonnegative().default(2048),
    peakTrafficMultiplier: z.number().finite().min(1).default(3),
    dataCreatedPerUserBytes: z.number().finite().nonnegative().default(10240),
    retentionPeriodDays: z.number().finite().nonnegative().default(365)
  })
  .strict()
  .superRefine((input, context) => {
    const [readRatio = 0, writeRatio = 0] = input.readWriteRatio
      .split(":")
      .map((value) => Number(value));

    if (readRatio + writeRatio <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Read/write ratio must have a positive total",
        path: ["readWriteRatio"]
      });
    }
  });

const metricSchema = z.object({
  raw: z.number().finite().nonnegative(),
  display: z.string().min(1),
  unit: z.string().min(1)
});

export const capacityCalculatorOutputSchema = z.object({
  toolName: z.literal(CAPACITY_CALCULATOR_TOOL_NAME),
  inputs: capacityCalculatorInputSchema,
  results: z.object({
    dailyActiveUsers: metricSchema,
    averageRequestsPerSecond: metricSchema,
    peakRequestsPerSecond: metricSchema,
    readQps: metricSchema,
    writeQps: metricSchema,
    dailyBandwidth: metricSchema,
    monthlyBandwidth: metricSchema,
    monthlyStorageGrowth: metricSchema,
    retainedStorageEstimate: metricSchema
  }),
  assumptions: z.array(z.string().min(1)),
  warnings: z.array(z.string().min(1))
});

export type CapacityCalculatorInput = z.infer<typeof capacityCalculatorInputSchema>;
export type CapacityCalculatorOutput = z.infer<typeof capacityCalculatorOutputSchema>;

