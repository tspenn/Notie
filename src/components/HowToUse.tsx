import { useState } from 'react';
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Library,
  NotebookPen,
  StickyNote,
  Tags,
} from 'lucide-react';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ReadingLamp } from '@/components/ReadingLamp';

interface HowToUseProps {
  open: boolean;
  onClose: () => void;
  /** Jump straight to the calendar section when opened from Calendar tab. */
  initialSection?: string;
}

interface Step {
  heading: string;
  body: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  steps: Step[];
}

const SECTIONS: Section[] = [
  {
    id: 'library',
    title: 'Library',
    icon: <Library className="h-4 w-4" />,
    steps: [
      {
        heading: 'Your shelf of notebooks',
        body: 'Each binding on the shelf is a writing project, with its name on the spine. Growth shows as the binding gets taller. Tap a book to open its Entry List.',
      },
      {
        heading: 'Previous entry',
        body: 'Above each book you may see “Previous entry: [title] — [date]” so you can see the last finished writing block at a glance.',
      },
    ],
  },
  {
    id: 'entries',
    title: 'Entry List',
    icon: <BookOpen className="h-4 w-4" />,
    steps: [
      {
        heading: 'Saved entries',
        body: 'After you open a book, you see past Entries — each with a title, date, and a short summary (~150 characters). Tap an Entry to open it in the Notebook.',
      },
      {
        heading: 'Inspiration',
        body: 'On the Entry List, the reading lamp and Inspiration field sit to the right. Inspiration is your short note — you write it; it is never AI-generated.',
      },
      {
        heading: 'Open notebook',
        body: 'Use Open notebook to enter the current writing space and keep drafting. Save Entry when a block of writing is finished.',
      },
    ],
  },
  {
    id: 'notebook',
    title: 'Notebook',
    icon: <NotebookPen className="h-4 w-4" />,
    steps: [
      {
        heading: 'Long-form writing surface',
        body: 'The Notebook is where essays, journaling, Bible study, and novel notes live. Write freely with formatting, images, and files.',
      },
      {
        heading: 'Entries (not sessions)',
        body: 'Draft while you write. Save Entry when finished — that moves it into history and grows the book on the Library shelf.',
      },
      {
        heading: 'Categories',
        body: 'Save snippets into Files, Gallery, Plans, Lists, To Do, or your own categories — a quick-reference panel beside your writing.',
      },
    ],
  },
  {
    id: 'inspiration',
    title: 'Inspiration & search',
    icon: <ReadingLamp size={18} lit={false} alt="" />,
    steps: [
      {
        heading: 'Inspiration field',
        body: 'A short, editable note on the Entry List (and in the Notebook toolbar) — a theme, verse, or line you want nearby while you write.',
      },
      {
        heading: 'Global search',
        body: 'Use the search icon to find across notebook titles, Inspiration, entry bodies, lists, and file names in your whole Library.',
      },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar setup',
    icon: <Calendar className="h-4 w-4" />,
    steps: [
      {
        heading: 'Connect any calendar with an ICS link',
        body: 'Open the Calendar tab, paste your ICS / iCalendar feed URL, then tap Sync now. Works with Google Calendar, Apple Calendar, Outlook, and any app that exports ICS.',
      },
      {
        heading: 'Google Calendar — secret address',
        body: 'calendar.google.com → calendar ⋮ menu → Settings and sharing → Integrate calendar → copy “Secret address in iCal format”. That is the URL to paste into Notie.',
      },
      {
        heading: 'Apple & Outlook',
        body: 'Apple: iCloud Calendar → share / public calendar → use the webcal link (change webcal:// to https://). Outlook: Settings → Shared calendars → Publish → ICS link.',
      },
      {
        heading: 'Read-only, always',
        body: 'Notie never writes back to your calendar. Events are pulled in for reference only — your real calendar stays exactly as you left it.',
      },
      {
        heading: 'Works on the free trial',
        body: 'You do not need a paid plan to try calendar sync. Paste a Google, Apple, or Outlook ICS link and tap Sync now — no account required for those providers.',
      },
      {
        heading: 'Sync on demand',
        body: 'Hit Sync now any time. Your ICS URL is saved, so you only paste it once. School or work domains may need a free account and a one-click “Allow this source” the first time.',
      },
    ],
  },
  {
    id: 'note-to-self',
    title: 'Note to self',
    icon: <StickyNote className="h-4 w-4" />,
    steps: [
      {
        heading: 'Reminders you set',
        body: 'Schedule a short note to yourself for later. Notie can notify you even when you are away from your desk.',
      },
      {
        heading: 'Must have notifications enabled',
        body: 'Must have notifications enabled on your device/s. Install Notie (or allow notifications in the browser) on each phone or computer you want notified.',
      },
    ],
  },
  {
    id: 'tips',
    title: 'Tips',
    icon: <BookOpen className="h-4 w-4" />,
    steps: [
      {
        heading: 'One entry per writing block',
        body: 'Start a new Entry each time you sit down. The title becomes your log — “Morning pages”, “Chapter 4”, “Study notes”.',
      },
      {
        heading: 'Categories as a second brain',
        body: 'Push the keepers into Plans, Lists, or To Do. When you return, the side panel is your quick reference.',
      },
      {
        heading: 'Search before you hunt',
        body: 'Global search covers titles, entry body, lists, and file names — faster than scrolling the shelf.',
      },
    ],
  },
];

function AccordionSection({
  section,
  defaultOpen,
}: {
  section: Section;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 bg-card/60 px-4 py-3 text-left transition-colors hover:bg-card"
      >
        <span className="text-moss">{section.icon}</span>
        <span className="flex-1 font-display text-sm font-semibold text-foreground">
          {section.title}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="space-y-4 bg-background/50 px-4 py-4">
          {section.steps.map((step, i) => (
            <div key={step.heading} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-moss/40 text-[10px] font-bold text-moss">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{step.heading}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HowToUse({ open, onClose, initialSection }: HowToUseProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>How to use Notie</SheetTitle>
        </SheetHeader>
        <p className="mt-2 text-sm text-muted-foreground">
          A quiet place for the writing that takes time — Library, Notebook, Entries, and your
          calendar.
        </p>
        <Separator className="my-4" />
        <div className="space-y-3 pb-8">
          {SECTIONS.map((section) => (
            <AccordionSection
              key={section.id}
              section={section}
              defaultOpen={initialSection ? section.id === initialSection : section.id === 'library'}
            />
          ))}
          <div className="flex items-start gap-2 rounded-lg border border-border bg-card/50 p-3 text-xs text-muted-foreground">
            <Tags className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moss" />
            <p>
              Categories, global search, and Note to self live in the main tabs and header — writing
              tools only, no AI assistant.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
