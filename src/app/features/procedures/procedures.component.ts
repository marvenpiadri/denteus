import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { DentalProcedure, ProcedureCategory } from '../../core/models/treatment.models';

@Component({
  selector: 'app-procedures',
  imports: [CommonModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 class="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <mat-icon class="text-teal-600 dark:text-teal-400">receipt_long</mat-icon>
            <span>Nomenclature & Catalogue des Actes</span>
          </h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Tarifs de référence du cabinet en Dirhams Marocains (MAD) et durées opératoires
          </p>
        </div>

        <button
          (click)="showNewModal.set(true)"
          class="px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow-sm transition-colors self-start">
          <mat-icon class="text-xs">add</mat-icon>
          <span>Ajouter un acte</span>
        </button>
      </div>

      <!-- Category Filter Tabs -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          (click)="selectedCategory.set('all')"
          [class.bg-teal-600]="selectedCategory() === 'all'"
          [class.text-white]="selectedCategory() === 'all'"
          [class.bg-white]="selectedCategory() !== 'all'"
          [class.dark:bg-neutral-900]="selectedCategory() !== 'all'"
          [class.text-neutral-700]="selectedCategory() !== 'all'"
          [class.dark:text-neutral-300]="selectedCategory() !== 'all'"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border border-neutral-200 dark:border-neutral-800 transition-colors">
          Tous les actes ({{ dataService.procedures().length }})
        </button>
        <button
          (click)="selectedCategory.set('soins_conservateurs')"
          [class.bg-teal-600]="selectedCategory() === 'soins_conservateurs'"
          [class.text-white]="selectedCategory() === 'soins_conservateurs'"
          [class.bg-white]="selectedCategory() !== 'soins_conservateurs'"
          [class.dark:bg-neutral-900]="selectedCategory() !== 'soins_conservateurs'"
          [class.text-neutral-700]="selectedCategory() !== 'soins_conservateurs'"
          [class.dark:text-neutral-300]="selectedCategory() !== 'soins_conservateurs'"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border border-neutral-200 dark:border-neutral-800 transition-colors">
          Soins Conservateurs
        </button>
        <button
          (click)="selectedCategory.set('endodontie')"
          [class.bg-teal-600]="selectedCategory() === 'endodontie'"
          [class.text-white]="selectedCategory() === 'endodontie'"
          [class.bg-white]="selectedCategory() !== 'endodontie'"
          [class.dark:bg-neutral-900]="selectedCategory() !== 'endodontie'"
          [class.text-neutral-700]="selectedCategory() !== 'endodontie'"
          [class.dark:text-neutral-300]="selectedCategory() !== 'endodontie'"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border border-neutral-200 dark:border-neutral-800 transition-colors">
          Endodontie
        </button>
        <button
          (click)="selectedCategory.set('prothese')"
          [class.bg-teal-600]="selectedCategory() === 'prothese'"
          [class.text-white]="selectedCategory() === 'prothese'"
          [class.bg-white]="selectedCategory() !== 'prothese'"
          [class.dark:bg-neutral-900]="selectedCategory() !== 'prothese'"
          [class.text-neutral-700]="selectedCategory() !== 'prothese'"
          [class.dark:text-neutral-300]="selectedCategory() !== 'prothese'"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border border-neutral-200 dark:border-neutral-800 transition-colors">
          Prothèse Dentaire
        </button>
        <button
          (click)="selectedCategory.set('chirurgie')"
          [class.bg-teal-600]="selectedCategory() === 'chirurgie'"
          [class.text-white]="selectedCategory() === 'chirurgie'"
          [class.bg-white]="selectedCategory() !== 'chirurgie'"
          [class.dark:bg-neutral-900]="selectedCategory() !== 'chirurgie'"
          [class.text-neutral-700]="selectedCategory() !== 'chirurgie'"
          [class.dark:text-neutral-300]="selectedCategory() !== 'chirurgie'"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border border-neutral-200 dark:border-neutral-800 transition-colors">
          Chirurgie
        </button>
        <button
          (click)="selectedCategory.set('parodontologie')"
          [class.bg-teal-600]="selectedCategory() === 'parodontologie'"
          [class.text-white]="selectedCategory() === 'parodontologie'"
          [class.bg-white]="selectedCategory() !== 'parodontologie'"
          [class.dark:bg-neutral-900]="selectedCategory() !== 'parodontologie'"
          [class.text-neutral-700]="selectedCategory() !== 'parodontologie'"
          [class.dark:text-neutral-300]="selectedCategory() !== 'parodontologie'"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border border-neutral-200 dark:border-neutral-800 transition-colors">
          Parodontologie
        </button>
        <button
          (click)="selectedCategory.set('implantologie')"
          [class.bg-teal-600]="selectedCategory() === 'implantologie'"
          [class.text-white]="selectedCategory() === 'implantologie'"
          [class.bg-white]="selectedCategory() !== 'implantologie'"
          [class.dark:bg-neutral-900]="selectedCategory() !== 'implantologie'"
          [class.text-neutral-700]="selectedCategory() !== 'implantologie'"
          [class.dark:text-neutral-300]="selectedCategory() !== 'implantologie'"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border border-neutral-200 dark:border-neutral-800 transition-colors">
          Implantologie
        </button>
      </div>

      <!-- Procedures Table -->
      <div class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              <th class="py-3 px-4">Code</th>
              <th class="py-3 px-4">Désignation de l'acte</th>
              <th class="py-3 px-4">Catégorie</th>
              <th class="py-3 px-4 text-center">Durée</th>
              <th class="py-3 px-4 text-right">Tarif Public (MAD)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800">
            @for (p of filteredProcedures(); track p.id) {
              <tr class="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                <td class="py-3 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">
                  {{ p.code }}
                </td>
                <td class="py-3 px-4 font-semibold text-neutral-900 dark:text-white">
                  {{ p.name }}
                </td>
                <td class="py-3 px-4 text-neutral-500 capitalize">
                  {{ p.category.replace('_', ' ') }}
                </td>
                <td class="py-3 px-4 text-center font-mono text-neutral-600 dark:text-neutral-400">
                  {{ p.durationMinutes }} min
                </td>
                <td class="py-3 px-4 text-right font-mono font-bold text-neutral-900 dark:text-white">
                  {{ i18n.formatCurrency(p.defaultFee) }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Modal: Nouvel Acte -->
      @if (showNewModal()) {
        <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 class="text-base font-bold text-neutral-900 dark:text-white">Ajouter un Acte au Catalogue</h3>
            <div class="space-y-3 text-xs">
              <div>
                <span class="block font-semibold mb-1">Code de l'acte</span>
                <input type="text" [(ngModel)]="newCode" placeholder="Ex: COMP-3, INLAY, BLANCH" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border" />
              </div>
              <div>
                <span class="block font-semibold mb-1">Désignation complète</span>
                <input type="text" [(ngModel)]="newName" placeholder="Ex: Inlay céramique pure E-Max" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="block font-semibold mb-1">Catégorie</span>
                  <select [(ngModel)]="newCategory" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border">
                    <option value="consultation">Consultation</option>
                    <option value="prevention">Prévention</option>
                    <option value="soins_conservateurs">Soins Conservateurs</option>
                    <option value="endodontie">Endodontie</option>
                    <option value="prothese">Prothèse</option>
                    <option value="chirurgie">Chirurgie</option>
                    <option value="parodontologie">Parodontologie</option>
                    <option value="implantologie">Implantologie</option>
                    <option value="esthetique">Esthétique</option>
                  </select>
                </div>
                <div>
                  <span class="block font-semibold mb-1">Tarif (MAD)</span>
                  <input type="number" [(ngModel)]="newFee" class="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border" />
                </div>
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t">
              <button (click)="showNewModal.set(false)" class="px-4 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800">Annuler</button>
              <button (click)="saveProcedure()" class="px-4 py-2 text-xs rounded-xl bg-teal-600 text-white font-semibold">Enregistrer l'acte</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProceduresComponent {
  readonly i18n = inject(I18nService);
  readonly dataService = inject(DentalDataService);

  readonly selectedCategory = signal<string>('all');
  readonly showNewModal = signal<boolean>(false);

  newCode = '';
  newName = '';
  newCategory: ProcedureCategory = 'soins_conservateurs';
  newFee = 500;

  readonly filteredProcedures = computed(() => {
    if (this.selectedCategory() === 'all') return this.dataService.procedures();
    return this.dataService.procedures().filter((p) => p.category === this.selectedCategory());
  });

  saveProcedure(): void {
    if (!this.newCode || !this.newName) return;
    const newProc: DentalProcedure = {
      id: `p-${Date.now()}`,
      code: this.newCode.toUpperCase(),
      name: this.newName,
      category: this.newCategory,
      defaultFee: this.newFee,
      durationMinutes: 45,
      requiresTooth: true,
      isActive: true,
    };
    this.dataService.procedures.update((list) => [...list, newProc]);
    this.showNewModal.set(false);
  }
}
