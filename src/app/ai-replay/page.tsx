import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AiReplayIndexPage() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        在这里管理与进入 AI 交易复盘的各项功能。
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/ai-replay/sessions">复盘会话</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/ai-replay/metrics">绩效指标</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/ai-replay/compare">策略对比</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/ai-replay/user-trades">用户交易记录</Link>
        </Button>
      </div>
    </div>
  );
}
