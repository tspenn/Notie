import { useState } from 'react';
import { Archive, Bell, BookOpen, CalendarDays, HelpCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { HowToUse } from '@/components/HowToUse';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  onOpenArchive: () => void;
  onOpenCalendar?: () => void;
}

const PLAN_LABEL: Record<string, string> = {
  one_device: 'Download — $9.99 one-time',
  cloud_sync: 'Sync — $3.99/mo or $39.99/year',
};

const NOTE_TO_SELF_PREF = 'notie_note_to_self_enabled';

export function Settings({ open, onClose, onOpenArchive, onOpenCalendar }: SettingsProps) {
  const { mode, plan, displayName, user, signOut } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );
  const [noteToSelfOn, setNoteToSelfOn] = useState(
    () => localStorage.getItem(NOTE_TO_SELF_PREF) !== 'false',
  );
  const [howToOpen, setHowToOpen] = useState(false);
  const [howToSection, setHowToSection] = useState<string | undefined>();

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === 'granted') {
      localStorage.setItem(NOTE_TO_SELF_PREF, 'true');
      setNoteToSelfOn(true);
      toast.success('Note to self enabled');
    }
  };

  const toggleNoteToSelf = (on: boolean) => {
    setNoteToSelfOn(on);
    localStorage.setItem(NOTE_TO_SELF_PREF, on ? 'true' : 'false');
    toast.success(on ? 'Note to self enabled' : 'Note to self disabled');
  };

  const openHowTo = (section?: string) => {
    setHowToSection(section);
    setHowToOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="flex flex-col overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Account
              </h3>
              <p className="mt-2 font-display text-lg text-foreground">{displayName}</p>
              <p className="text-sm text-muted-foreground">
                {mode === 'cloud' ? user?.email : 'Download / One Device — stored on this browser only'}
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Plan
              </h3>
              <p className="mt-2 text-sm text-foreground">{PLAN_LABEL[plan] ?? plan}</p>
              {mode === 'local' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Writing stays on this device. Upgrade to Sync any time to write from anywhere.
                </p>
              )}
            </section>

            <Separator />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Note to self
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Keeps you informed even when you are away from your desk (reminders you set,
                sync-related alerts if any).
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Must have notifications enabled on your device/s.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Install Notie (or allow notifications in the browser) on each phone or computer you
                want notified.
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-card/50 px-3 py-2">
                <span className="text-sm text-foreground">Note to self</span>
                <Switch checked={noteToSelfOn} onCheckedChange={toggleNoteToSelf} />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void requestPermission()}
                disabled={permission === 'granted'}
              >
                <Bell className="mr-1.5 h-3.5 w-3.5" />
                {permission === 'granted' ? 'Notifications enabled' : 'Enable notifications'}
              </Button>
            </section>

            <Separator />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Calendar
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect Google, Apple, or Outlook with an ICS / secret iCal link. Notie syncs
                read-only — it never writes back to your calendar.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenCalendar?.();
                  }}
                >
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                  Open Calendar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openHowTo('calendar')}>
                  <HelpCircle className="mr-1.5 h-3.5 w-3.5" />
                  How to get my ICS link
                </Button>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                How to use
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Library, Notebook, Entries, Inspiration, search, calendar, and Note to self.
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => openHowTo()}>
                <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                How to use Notie
              </Button>
            </section>

            <Separator />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                About Notie
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                A quiet place for the writing that takes time. Long-form notebooks — no AI assistant.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                <a href="https://my-notie.com" className="text-moss underline-offset-2 hover:underline">
                  my-notie.com
                </a>
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Library
              </h3>
              <Button variant="outline" size="sm" className="mt-2" onClick={onOpenArchive}>
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                Archived notebooks
              </Button>
            </section>

            <Separator />

            <Button variant="outline" className="w-full" onClick={() => void signOut()}>
              <LogOut className="mr-1.5 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <HowToUse
        open={howToOpen}
        onClose={() => setHowToOpen(false)}
        initialSection={howToSection}
      />
    </>
  );
}
