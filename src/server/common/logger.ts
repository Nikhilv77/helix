export class Logger {
  constructor(private readonly context: string) {}

  log(message: unknown): void {
    console.log(this.format(message));
  }

  warn(message: unknown): void {
    console.warn(this.format(message));
  }

  error(message: unknown, trace?: unknown): void {
    console.error(this.format(message), trace ?? "");
  }

  private format(message: unknown): string {
    const body = typeof message === "string" ? message : JSON.stringify(message);
    return `[${this.context}] ${body}`;
  }
}
