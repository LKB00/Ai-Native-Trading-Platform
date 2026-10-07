import type { ReactNode, SVGProps } from "react";
import { cn } from "../lib/cn";
import { XIcon } from "../lib/icons";
import { Button } from "../atoms/Button";

export type VoiceState = "listening" | "thinking" | "speaking" | "interrupted" | "muted" | "reconnecting";

export interface VoiceCaption {
  id: string;
  speaker: "you" | "assistant";
  text: string;
}

export interface VoicePanelProps {
  state: VoiceState;
  /** Overrides the visible text for each state. */
  stateLabels?: Partial<Record<VoiceState, string>>;
  /** Live captions, oldest first. */
  captions?: VoiceCaption[];
  /** Speaker names used in captions. */
  speakerLabels?: { you: string; assistant: string };
  emptyCaptions?: string;
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  onEnd?: () => void;
  /** Camera toggle shows when `onCameraChange` is given. */
  cameraOn?: boolean;
  onCameraChange?: (on: boolean) => void;
  /** Screen share toggle shows when `onScreenShareChange` is given. */
  screenSharing?: boolean;
  onScreenShareChange?: (on: boolean) => void;
  /** Extra content under the orb, for example a connection hint. */
  footer?: ReactNode;
  className?: string;
}

const defaultLabels: Record<VoiceState, string> = {
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  interrupted: "Interrupted",
  muted: "Muted",
  reconnecting: "Reconnecting",
};

const icon = (p: SVGProps<SVGSVGElement>) => ({ width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p });
const MicIcon = () => <svg {...icon({})}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
const MicOffIcon = () => <svg {...icon({})}><path d="M4 4l16 16M9 9v2a3 3 0 0 0 5 2M15 9V6a3 3 0 0 0-5.5-1.7M5 11a7 7 0 0 0 11 5.7M12 18v3" /></svg>;
const CameraIcon = () => <svg {...icon({})}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></svg>;
const ScreenIcon = () => <svg {...icon({})}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>;

function Orb({ state }: { state: VoiceState }) {
  const calm = state === "muted" || state === "interrupted";
  return (
    <div aria-hidden className="relative flex size-28 items-center justify-center">
      {state === "listening" && <span className="absolute inset-0 rounded-full bg-lime/40 animate-pulse motion-reduce:animate-none" />}
      {state === "thinking" && <span className="absolute inset-0 rounded-full border-2 border-dashed border-line-strong animate-spin motion-reduce:animate-none" />}
      {state === "reconnecting" && <span className="absolute inset-0 rounded-full border-2 border-dashed border-line-strong animate-pulse motion-reduce:animate-none" />}
      <span className={cn("relative flex size-20 items-center justify-center gap-1 rounded-full transition-colors", calm || state === "reconnecting" || state === "thinking" ? "bg-sunken border border-line" : "bg-lime")}>
        {state === "speaking" && [0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="w-1 rounded-full bg-on-lime animate-pulse motion-reduce:animate-none" style={{ height: [14, 28, 38, 24, 16][i], animationDelay: `${i * 120}ms` }} />
        ))}
        {state === "listening" && <span className="size-3 rounded-full bg-on-lime" />}
        {state === "interrupted" && <span className="h-6 w-1 rounded-full bg-fg-muted" />}
        {state === "muted" && <span className="text-fg-muted"><MicOffIcon /></span>}
      </span>
    </div>
  );
}

/** Voice conversation panel. The state always appears as text beside the orb, and captions give the conversation without audio. */
export function VoicePanel({
  state, stateLabels, captions = [], speakerLabels = { you: "You", assistant: "Assistant" }, emptyCaptions = "Captions appear here as you talk.",
  muted, onMutedChange, onEnd, cameraOn, onCameraChange, screenSharing, onScreenShareChange, footer, className,
}: VoicePanelProps) {
  const label = { ...defaultLabels, ...stateLabels }[state];
  const isMuted = muted ?? state === "muted";
  return (
    <section aria-label="Voice conversation" className={cn("flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-line bg-surface p-6", className)}>
      <Orb state={state} />
      <p role="status" className="text-sm font-medium text-fg">{label}</p>
      {footer}
      <div role="region" aria-label="Live captions" tabIndex={0} className="max-h-40 w-full space-y-2 overflow-y-auto rounded-2xl bg-sunken p-3 text-[13px]">
        {captions.length === 0 ? (
          <p className="text-fg-muted">{emptyCaptions}</p>
        ) : captions.map((c) => (
          <p key={c.id} className={c.speaker === "you" ? "text-fg-muted" : "text-fg"}>
            <span className="font-medium">{speakerLabels[c.speaker]}: </span>{c.text}
          </p>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" aria-pressed={isMuted} onClick={() => onMutedChange?.(!isMuted)} leading={isMuted ? <MicOffIcon /> : <MicIcon />}>Mute</Button>
        {onCameraChange && <Button variant="secondary" aria-pressed={!!cameraOn} onClick={() => onCameraChange(!cameraOn)} leading={<CameraIcon />}>Camera</Button>}
        {onScreenShareChange && <Button variant="secondary" aria-pressed={!!screenSharing} onClick={() => onScreenShareChange(!screenSharing)} leading={<ScreenIcon />}>Share screen</Button>}
        <Button variant="primary" onClick={onEnd} leading={<XIcon width={14} height={14} />}>End</Button>
      </div>
    </section>
  );
}
