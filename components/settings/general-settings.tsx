'use client';

import { useState, useCallback, useRef, type ChangeEvent } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2, AlertTriangle, Download, Upload } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import {
  clearDatabase,
  exportPortableDatabase,
  importPortableDatabase,
  initDatabase,
  type PortableDatabaseBackup,
} from '@/lib/utils/database';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const log = createLogger('GeneralSettings');

export function GeneralSettings() {
  const { t } = useI18n();

  // Clear cache state
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const confirmPhrase = t('settings.clearCacheConfirmPhrase');
  const isConfirmValid = confirmInput === confirmPhrase;

  const handleClearCache = useCallback(async () => {
    if (!isConfirmValid) return;
    setClearing(true);
    try {
      // 1. Clear IndexedDB
      await clearDatabase();
      // 2. Clear localStorage
      localStorage.clear();
      // 3. Clear sessionStorage
      sessionStorage.clear();

      toast.success(t('settings.clearCacheSuccess'));

      // Reload page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      log.error('Failed to clear cache:', error);
      toast.error(t('settings.clearCacheFailed'));
      setClearing(false);
    }
  }, [isConfirmValid, t]);

  const clearCacheItems =
    t('settings.clearCacheConfirmItems').split('、').length > 1
      ? t('settings.clearCacheConfirmItems').split('、')
      : t('settings.clearCacheConfirmItems').split(', ');

  const handleExportBackup = useCallback(async () => {
    setExporting(true);
    try {
      const backup = await exportPortableDatabase();
      const localStorageSnapshot: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        localStorageSnapshot[key] = localStorage.getItem(key) ?? '';
      }
      const payload = {
        format: 'openmaic-portable-backup-v1' as const,
        db: backup,
        localStorage: localStorageSnapshot,
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openmaic-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('settings.backupExportSuccess'));
    } catch (error) {
      log.error('Failed to export backup:', error);
      toast.error(t('settings.backupExportFailed'));
    } finally {
      setExporting(false);
    }
  }, [t]);

  const handleImportBackupFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      const confirmed = window.confirm(t('settings.backupImportConfirm'));
      if (!confirmed) return;

      setImporting(true);
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as
          | PortableDatabaseBackup
          | {
              format?: string;
              db?: PortableDatabaseBackup;
              localStorage?: Record<string, string>;
            };
        const backup =
          typeof parsed === 'object' &&
          parsed !== null &&
          'format' in parsed &&
          parsed.format === 'openmaic-portable-backup-v1' &&
          parsed.db
            ? parsed.db
            : (parsed as PortableDatabaseBackup);

        await clearDatabase();
        await initDatabase();
        await importPortableDatabase(backup);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'format' in parsed &&
          parsed.format === 'openmaic-portable-backup-v1'
        ) {
          localStorage.clear();
          const storage = parsed.localStorage ?? {};
          for (const [key, value] of Object.entries(storage)) {
            localStorage.setItem(key, value);
          }
        }
        toast.success(t('settings.backupImportSuccess'));
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        log.error('Failed to import backup:', error);
        toast.error(t('settings.backupImportFailed'));
      } finally {
        setImporting(false);
      }
    },
    [t],
  );

  return (
    <div className="flex flex-col gap-8">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportBackupFile}
      />

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t('settings.backupData')}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {t('settings.backupDataDescription')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handleExportBackup} disabled={exporting}>
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              {t('settings.exportBackup')}
            </Button>
            <Button
              size="sm"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              variant="secondary"
            >
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5 mr-1.5" />
              )}
              {t('settings.importBackup')}
            </Button>
          </div>
        </div>
      </div>

      {/* Danger Zone - Clear Cache */}
      <div className="relative rounded-xl border border-destructive/30 bg-destructive/[0.03] dark:bg-destructive/[0.06] overflow-hidden">
        {/* Subtle diagonal stripe pattern for danger emphasis */}
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 10px,
              currentColor 10px,
              currentColor 11px
            )`,
          }}
        />

        <div className="relative p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-destructive/10 text-destructive">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-destructive">{t('settings.dangerZone')}</h3>
          </div>

          {/* Content */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t('settings.clearCache')}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t('settings.clearCacheDescription')}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setConfirmInput('');
                setShowClearDialog(true);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {t('settings.clearCache')}
            </Button>
          </div>
        </div>
      </div>

      {/* Clear Cache Confirmation Dialog */}
      <AlertDialog
        open={showClearDialog}
        onOpenChange={(open) => {
          if (!clearing) {
            setShowClearDialog(open);
            if (!open) setConfirmInput('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              {t('settings.clearCacheConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{t('settings.clearCacheConfirmDescription')}</p>
                <ul className="space-y-1.5 ml-1">
                  {clearCacheItems.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive/60 shrink-0" />
                      {item.trim()}
                    </li>
                  ))}
                </ul>
                <div className="pt-1">
                  <Label className="text-xs font-medium text-foreground">
                    {t('settings.clearCacheConfirmInput')}
                  </Label>
                  <Input
                    className="mt-1.5 h-9 text-sm"
                    placeholder={confirmPhrase}
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isConfirmValid) {
                        handleClearCache();
                      }
                    }}
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>{t('common.cancel')}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!isConfirmValid || clearing}
              onClick={handleClearCache}
            >
              {clearing ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1.5" />
              )}
              {t('settings.clearCacheButton')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
