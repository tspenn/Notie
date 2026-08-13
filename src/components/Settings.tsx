import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  Bell,
  BookOpen,
  CalendarDays,
  Download,
  HelpCircle,
  LogOut,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { downloadNotieBackup, restoreNotieBackup } from '@/lib/backup';
import { fetchNotieTiers, startNotieCheckout } from '@/lib/checkout';
import { canCloudSync, planLabel } from '@/lib/plan';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { HowToUse } from '@/components/HowToUse';
import { AuthModal } from '@/components/AuthModal';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  onOpenArchive: () => void;
  onOpenCalendar?: () => void;
}

const NOTE_TO_SELF_PREF = 'notie_note_to_self_enabled';

export function Settings({ open, onClose, onOpenArchive, onOpenCalendar }: SettingsProps) {
  const { mode, plan, displayName, user, signOut, trialDaysRemaining, refreshPlan, syncNow } =
    useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!open) return;
    setPlanBusy(false);
    setSyncBusy(false);
    if (mode === 'cloud') {
      void refreshPlan().catch(() => undefined);
    }
  }, [open, mode, refreshPlan]);

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
                {mode === 'cloud'
                  ? user?.email
                  : plan === 'trial'
                    ? 'Free trial — on this device (sign in to Sync across devices)'
                    : 'Download — on this device only'}
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Plan
              </h3>
              <p className="mt-2 text-sm text-foreground">{planLabel(plan)}</p>
              {plan === 'trial' && trialDaysRemaining !== null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {trialDaysRemaining > 0
                    ? `${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} left in your free trial.`
                    : 'Your free trial has ended.'}
                </p>
              )}
              {plan === 'trial' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Sync across devices is included for your trial. Export / Save to Device is always
                  yours.
                </p>
              )}
              {plan === 'one_device' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  One device forever. Upgrade to Sync anytime to write on other devices.
                </p>
              )}
              {plan === 'cloud_sync' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Sync is on — your library follows every device you sign in on.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {mode === 'cloud' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={planBusy}
                    onClick={async () => {
                      setPlanBusy(true);
                      try {
                        const next = await refreshPlan();
                        toast.success(`Plan: ${planLabel(next)}`);
                      } catch {
                        toast.error('Could not refresh plan');
                      } finally {
                        setPlanBusy(false);
                      }
                    }}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Refresh plan
                  </Button>
                )}
                {canCloudSync(plan) && mode === 'cloud' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={syncBusy}
                    onClick={async () => {
                      setSyncBusy(true);
                      try {
                        await syncNow();
                        toast.success('Library synced');
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Sync failed');
                      } finally {
                        setSyncBusy(false);
                      }
                    }}
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncBusy ? 'animate-spin' : ''}`} />
                    {syncBusy ? 'Syncing…' : 'Sync now'}
                  </Button>
                )}
                {(plan === 'trial' || plan === 'one_device') && (
                  <Button
                    size="sm"
                    disabled={planBusy}
                    onClick={async () => {
                      if (mode !== 'cloud') {
                        setAuthOpen(true);
                        return;
                      }
                      setPlanBusy(true);
                      try {
                        const tiers = await fetchNotieTiers();
                        const syncTier = tiers.find(
                          (t) =>
                            (t.features?.key as string) === 'cloud_sync' || t.name === 'Cloud Sync',
                        );
                        if (!syncTier) throw new Error('Sync plan not found');
                        await startNotieCheckout({
                          tierId: syncTier.id,
                          billingCycle: 'monthly',
                        });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Checkout failed');
                      } finally {
                        // Checkout redirects away on success; if it doesn't, unlock buttons again.
                        setPlanBusy(false);
                      }
                    }}
                  >
                    Upgrade to Sync
                  </Button>
                )}
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Backup &amp; export
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Download a full encrypted library backup (.notiebak), or restore one onto this
                device. Available on every plan — your writing is yours.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={backupBusy}
                  onClick={async () => {
                    setBackupBusy(true);
                    try {
                      await downloadNotieBackup();
                      toast.success('Backup downloaded');
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Backup failed');
                    } finally {
                      setBackupBusy(false);
                    }
                  }}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {backupBusy ? 'Working…' : 'Download backup'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={backupBusy}
                  onClick={() => restoreInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Restore backup
                </Button>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept=".notiebak,application/octet-stream"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    if (
                      !window.confirm(
                        'Restore will replace the library on this device with the backup. Continue?',
                      )
                    ) {
                      return;
                    }
                    setBackupBusy(true);
                    try {
                      const result = await restoreNotieBackup(
                        file,
                        mode === 'cloud' ? user?.id : null,
                      );
                      toast.success(
                        `Restored ${result.notebooks} notebook${result.notebooks === 1 ? '' : 's'}, ${result.entries} entries`,
                      );
                      window.location.reload();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Restore failed');
                    } finally {
                      setBackupBusy(false);
                    }
                  }}
                />
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Library &amp; Growth
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Each notebook on your Library shelf is a writing project. The book binding shows{' '}
                <span className="font-medium text-foreground">Growth</span> as that project grows —
                the more you write and Save Entries, the taller the binding becomes.
              </p>
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

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode="signup" />
    </>
  );
}
