import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { DentalDataService } from '../../core/services/dental-data.service';

@Component({
  selector: 'app-audit-trail',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 class="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <mat-icon class="text-teal-600 dark:text-teal-400">security</mat-icon>
            <span>Journal d'Audit & Traçabilité Médico-Légale</span>
          </h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Enregistrement horodaté et inaltérable de chaque modification clinique, acte ou encaissement
          </p>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
            <mat-icon class="text-xs" style="font-size: 14px; width: 14px; height: 14px;">verified_user</mat-icon>
            <span>Audit Actif & Conforme</span>
          </span>
        </div>
      </div>

      <!-- Audit Logs Table -->
      <div class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                <th class="py-3 px-4">Horodatage</th>
                <th class="py-3 px-4">Utilisateur</th>
                <th class="py-3 px-4">Action</th>
                <th class="py-3 px-4">Module</th>
                <th class="py-3 px-4">Description de l'opération</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800 font-mono">
              @for (log of dataService.auditLogs(); track log.id) {
                <tr class="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                  <td class="py-3 px-4 whitespace-nowrap text-neutral-500">
                    {{ i18n.formatDate(log.timestamp) }} {{ log.timestamp.split('T')[1].substring(0, 8) }}
                  </td>
                  <td class="py-3 px-4 font-sans font-semibold text-neutral-900 dark:text-white whitespace-nowrap">
                    {{ log.userName }}
                  </td>
                  <td class="py-3 px-4 font-sans">
                    <span class="text-[11px] font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {{ log.action }}
                    </span>
                  </td>
                  <td class="py-3 px-4 font-sans capitalize text-neutral-500">
                    {{ log.entityType.replace('_', ' ') }}
                  </td>
                  <td class="py-3 px-4 font-sans text-neutral-700 dark:text-neutral-300">
                    {{ log.description }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class AuditTrailComponent {
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);
}
