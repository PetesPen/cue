import { REMINDER_DAYS, type Reminder } from '@/model';
import { AlertIcon, CheckIcon, CloseIcon } from './Icons';

/**
 * "Your decks live only in this browser" (SV-8; design: Home, the backup reminder): shown on the library when
 * a deck has changed since it was last put in a file and that file is two weeks old or more. Its button makes
 * the backup; its close button hides it for 14 days.
 */
export function BackupReminderBanner({
  reminder,
  busy,
  onBackup,
  onClose,
}: {
  readonly reminder: Reminder;
  readonly busy: boolean;
  readonly onBackup: () => void;
  readonly onClose: () => void;
}) {
  const since = reminder.never
    ? 'You haven’t backed them up yet.'
    : `It has been ${String(reminder.days)} day${reminder.days === 1 ? '' : 's'} since your last backup.`;
  return (
    <div className="banner banner-warning" role="status">
      <span className="banner-icon">
        <AlertIcon size={15} />
      </span>
      <span className="banner-text">
        <strong>Your decks live only in this browser.</strong> {since} Export a copy so a cleared
        cache can’t take them with it.
      </span>
      <button
        type="button"
        className="button button-compact button-strong"
        disabled={busy}
        onClick={onBackup}
      >
        {busy ? 'Backing up…' : 'Back up all decks'}
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={`Hide this for ${String(REMINDER_DAYS)} days`}
        onClick={onClose}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/** What a backup or opening a backup did, in a line the person can read and dismiss (SV-8). */
export interface Notice {
  readonly tone: 'good' | 'warning';
  readonly title: string;
  readonly text: string;
}

export function NoticeBanner({
  notice,
  onClose,
}: {
  readonly notice: Notice;
  readonly onClose: () => void;
}) {
  return (
    <div
      className={`banner ${notice.tone === 'good' ? 'banner-good' : 'banner-warning'}`}
      role="status"
    >
      <span className="banner-icon">
        {notice.tone === 'good' ? <CheckIcon size={15} /> : <AlertIcon size={15} />}
      </span>
      <span className="banner-text">
        <strong>{notice.title}</strong> {notice.text}
      </span>
      <button type="button" className="icon-button" aria-label="Dismiss" onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}
