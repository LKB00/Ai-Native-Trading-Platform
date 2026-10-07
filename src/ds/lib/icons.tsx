// Every icon in the product comes from one family: Lucide (lucide.dev, ISC licence).
// This module keeps the Sandstone export names and sets the Sandstone defaults once:
// 16px, 1.5 stroke, round caps, hidden from screen readers.
import type { SVGProps } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, ArrowUp, BookOpen, Bookmark, Camera, Check, ChevronRight, CircleCheck, Copy, Download,
  Ellipsis, Eye, File, FileSearch, Flag, GitBranch, Globe, History, Image, Info, Layers, Link, ListChecks,
  Lock, Mic, MicOff, Moon, Paperclip, Pencil, Pin, Plus, Quote, RefreshCw, Repeat, RotateCcw, Search,
  Settings2, Share, Shield, Sparkles, Square, Sun, ThumbsDown, ThumbsUp, TriangleAlert, Undo2, Redo2,
  Users, Wrench, X, ArrowLeftRight, Package, WandSparkles, TextQuote, MessageCircle, MemoryStick, Palette,
} from "lucide-react";

type P = SVGProps<SVGSVGElement>;

export function lucide(I: LucideIcon, size = 16, stroke = 1.5) {
  const C = ({ width, height, ...p }: P) => (
    <I size={(width as number) ?? size} height={height} strokeWidth={stroke} aria-hidden {...(p as object)} />
  );
  return C;
}

export const SendIcon = lucide(ArrowUp);
export const StopIcon = lucide(Square);
export const CopyIcon = lucide(Copy);
export const CheckIcon = lucide(Check);
export const XIcon = lucide(X);
export const ThumbUpIcon = lucide(ThumbsUp);
export const ThumbDownIcon = lucide(ThumbsDown);
export const RefreshIcon = lucide(RefreshCw);
export const SparkleIcon = lucide(Sparkles);
export const ChevronIcon = lucide(ChevronRight);
export const PaperclipIcon = lucide(Paperclip);
export const AlertIcon = lucide(TriangleAlert);
export const InfoIcon = lucide(Info);
export const ToolIcon = lucide(Wrench);
export const GlobeIcon = lucide(Globe);
export const PlusIcon = lucide(Plus);
export const ImageIcon = lucide(Image);
export const ShieldIcon = lucide(Shield);
export const MoonIcon = lucide(Moon);
export const SunIcon = lucide(Sun);
export const FileIcon = lucide(File);
export const SearchIcon = lucide(Search);
export const UsersIcon = lucide(Users);

// Actions
export const RegenerateIcon = lucide(WandSparkles);
export const RetryIcon = lucide(RotateCcw);
export const EditIcon = lucide(Pencil);
export const UndoIcon = lucide(Undo2);
export const RedoIcon = lucide(Redo2);
export const ShareIcon = lucide(Share);
export const DownloadIcon = lucide(Download);
export const PinIcon = lucide(Pin);
export const BookmarkIcon = lucide(Bookmark);
export const SettingsIcon = lucide(Settings2);
export const MoreIcon = lucide(Ellipsis);
export const SyncIcon = lucide(ArrowLeftRight);
export const LoopIcon = lucide(Repeat);

// Media and input
export const MicIcon = lucide(Mic);
export const MicOffIcon = lucide(MicOff);
export const CameraIcon = lucide(Camera);
export const EyeIcon = lucide(Eye);
export const LockIcon = lucide(Lock);

// Agent and context
export const MemoryIcon = lucide(MemoryStick);
export const NotebookIcon = lucide(BookOpen);
export const PlanIcon = lucide(ListChecks);
export const CheckpointIcon = lucide(Flag);
export const BranchIcon = lucide(GitBranch);
export const ContextIcon = lucide(Package);
export const LayersIcon = lucide(Layers);
export const HistoryIcon = lucide(History);
export const ThoughtIcon = lucide(MessageCircle);

// Trust and review
export const CitationIcon = lucide(Quote);
export const SourceIcon = lucide(Link);
export const ApproveIcon = lucide(CircleCheck);
export const NeedsReviewIcon = lucide(FileSearch);

// AI actions
export const AIEditIcon = lucide(Pencil);
export const AISummarizeIcon = lucide(TextQuote);
export const AIEnhanceIcon = lucide(WandSparkles);
export const AISuggestIcon = lucide(Sparkles);
export const RevertAIIcon = lucide(Undo2);
export const ArrowRightIcon = lucide(ArrowRight);
export const PaletteIcon = lucide(Palette);
