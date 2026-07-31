import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "./button";
import { Card } from "./card";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void | Promise<void>;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Card className="border-red-400/35 bg-red-500/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 text-red-300" size={18} />
          <div>
            <p className="text-sm font-semibold text-red-100">Something needs attention</p>
            <p className="mt-1 text-sm leading-6 text-red-200">{message}</p>
          </div>
        </div>
        {onRetry ? (
          <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={() => void onRetry()}>
            Retry
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
