import { Button } from "../atoms/Button";
import { Callout } from "./Callout";


export function RateLimitNotice({ resetsIn, onUpgrade }: { resetsIn: string; onUpgrade?: () => void }) {
  return <Callout tone="warning" title="You've reached the usage limit" action={onUpgrade && <Button size="sm" onClick={onUpgrade}>Upgrade</Button>}>Limits reset in {resetsIn}.</Callout>;
}
