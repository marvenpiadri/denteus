import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { I18nService } from '../../core/services/i18n.service';
import { ThemeService } from '../../core/services/theme.service';
import { TenantService } from '../../core/services/tenant.service';
import { DentalDataService } from '../../core/services/dental-data.service';
import { NavigationTab } from '../../core/components/sidebar.component';

@Component({
  selector: 'app-home-landing',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans">
      <!-- TOP NAVIGATION BAR FOR HOME LANDING PAGE -->
      <header class="sticky top-0 z-50 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <!-- Logo & Brand -->
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-teal-600/20">
              D
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">Denteus</span>
                <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 rounded-full border border-teal-200 dark:border-teal-800">
                  Cloud HDS
                </span>
              </div>
              <p class="text-[11px] text-neutral-500 dark:text-neutral-400 hidden sm:block">Cabinet Dentaire Intelligent & Moderne</p>
            </div>
          </div>

          <!-- Desktop Center Navigation Links -->
          <nav class="hidden md:flex items-center gap-6 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            <a href="#features" class="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">Fonctionnalités</a>
            <a href="#odontogram" class="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">Odontogramme</a>
            <a href="#waiting-room" class="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">Salle d'Attente</a>
            <a href="#pricing" class="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">Tarifs</a>
            <a href="#simulator" class="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">Simulateur</a>
            <a href="#security" class="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">Sécurité HDS</a>
          </nav>

          <!-- Right Action Controls: Lang + Theme + CTA to enter App -->
          <div class="flex items-center gap-2 sm:gap-3">
            <!-- Locale Switcher -->
            <div class="flex items-center rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5 text-xs">
              <button
                type="button"
                (click)="i18n.setLocale('fr')"
                [class.bg-white]="i18n.currentLocale() === 'fr'"
                [class.dark:bg-neutral-700]="i18n.currentLocale() === 'fr'"
                [class.shadow-xs]="i18n.currentLocale() === 'fr'"
                class="px-2 py-1 rounded font-bold uppercase transition-all">
                FR
              </button>
              <button
                type="button"
                (click)="i18n.setLocale('en')"
                [class.bg-white]="i18n.currentLocale() === 'en'"
                [class.dark:bg-neutral-700]="i18n.currentLocale() === 'en'"
                [class.shadow-xs]="i18n.currentLocale() === 'en'"
                class="px-2 py-1 rounded font-bold uppercase transition-all">
                EN
              </button>
              <button
                type="button"
                (click)="i18n.setLocale('ar')"
                [class.bg-white]="i18n.currentLocale() === 'ar'"
                [class.dark:bg-neutral-700]="i18n.currentLocale() === 'ar'"
                [class.shadow-xs]="i18n.currentLocale() === 'ar'"
                class="px-2 py-1 rounded font-bold uppercase transition-all">
                AR
              </button>
            </div>

            <!-- Dark / Light Theme Toggle -->
            <button
              type="button"
              (click)="themeService.toggleTheme()"
              aria-label="Basculer le thème"
              class="p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <mat-icon style="font-size: 20px; width: 20px; height: 20px;">
                {{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}
              </mat-icon>
            </button>

            <!-- Primary CTA Button: Launch Clinical App -->
            <button
              type="button"
              (click)="launchApp('dashboard')"
              class="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-semibold text-xs sm:text-sm shadow-md shadow-teal-600/25 transition-all">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">meeting_room</mat-icon>
              <span>Accéder au Cabinet</span>
            </button>
          </div>
        </div>
      </header>

      <!-- HERO SECTION -->
      <section class="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-neutral-200 dark:border-neutral-800">
        <!-- Background decorative ambient gradients -->
        <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-teal-500/10 via-emerald-500/5 to-transparent blur-3xl pointer-events-none"></div>

        <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-3xl mx-auto space-y-6">
            <!-- Badge -->
            <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-semibold shadow-xs">
              <mat-icon style="font-size: 16px; width: 16px; height: 16px;">verified</mat-icon>
              <span>Hébergeur de Données de Santé (HDS) & Normes ISO 27001</span>
            </div>

            <!-- Main Heading -->
            <h1 class="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 dark:text-white leading-[1.15]">
              Le Dossier Patient Dentaire <span class="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">Nouvelle Génération</span>
            </h1>

            <!-- Subheading -->
            <p class="text-base sm:text-lg text-neutral-600 dark:text-neutral-300 font-normal leading-relaxed">
              Une solution clinique cloud conçue avec des chirurgiens-dentistes. Odontogramme graphique interactif multi-surfaces, bilan parodontal normalisé à 6 points, salle d'attente synchronisée en direct et gestion multi-fauteuils.
            </p>

            <!-- Action Buttons -->
            <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                (click)="launchApp('dashboard')"
                class="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-teal-600/30 transition-all">
                <mat-icon style="font-size: 20px; width: 20px; height: 20px;">local_hospital</mat-icon>
                <span>Ouvrir l'Espace Clinique</span>
              </button>

              <button
                type="button"
                (click)="launchApp('patients')"
                class="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold text-sm shadow-xs transition-all">
                <mat-icon class="text-teal-600 dark:text-teal-400" style="font-size: 20px; width: 20px; height: 20px;">dentistry</mat-icon>
                <span>Voir l'Odontogramme Interactif</span>
              </button>

              <button
                type="button"
                (click)="launchApp('waiting-room')"
                class="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-semibold text-sm shadow-xs transition-all">
                <mat-icon class="text-amber-600 dark:text-amber-400" style="font-size: 20px; width: 20px; height: 20px;">meeting_room</mat-icon>
                <span>Salle d'Attente Direct ({{ dataService.liveFlowWaiting().length }} en cours)</span>
              </button>
            </div>

            <!-- Key metrics row -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-10 border-t border-neutral-200 dark:border-neutral-800 text-left">
              <div class="p-3 rounded-xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800">
                <div class="text-2xl font-black text-neutral-900 dark:text-white font-mono">100%</div>
                <div class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Cloud HDS sécurisé</div>
              </div>
              <div class="p-3 rounded-xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800">
                <div class="text-2xl font-black text-teal-600 dark:text-teal-400 font-mono">32 Dents</div>
                <div class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">FDI & Universal 6 surfaces</div>
              </div>
              <div class="p-3 rounded-xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800">
                <div class="text-2xl font-black text-neutral-900 dark:text-white font-mono">6 Points</div>
                <div class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Sondage parodontal précis</div>
              </div>
              <div class="p-3 rounded-xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800">
                <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">&lt; 1 sec</div>
                <div class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Synchronisation temps réel</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION: CORE CLINICAL MODULES (FEATURES) -->
      <section id="features" class="py-16 md:py-24 bg-white dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div class="text-center max-w-2xl mx-auto space-y-3">
            <span class="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">Suite Clinique Complète</span>
            <h2 class="text-2xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white">Tout ce dont votre clinique a besoin, sans compromis</h2>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">Chaque module est relié de manière fluide : de l'accueil du patient en salle d'attente jusqu'à la cotation de l'acte et l'historique d'audit.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Module 1: Odontogramme Graphique -->
            <div class="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between hover:border-teal-500 transition-all group">
              <div class="space-y-4">
                <div class="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-300 flex items-center justify-center">
                  <mat-icon style="font-size: 26px; width: 26px; height: 26px;">dentistry</mat-icon>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-neutral-900 dark:text-white">Odontogramme Graphique Avancé</h3>
                  <p class="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 leading-relaxed">
                    Cartographie dentaire des 32 dents permanentes. Sélection intuitive des surfaces (Vestibulaire, Palatine/Linguale, Mésiale, Distale, Occlusale). Gestion des caries, couronnes, implants, endodontie et extractions.
                  </p>
                </div>
                <div class="flex flex-wrap gap-1.5 text-[11px] font-mono">
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Système FDI / ISO 3950</span>
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Système Universal</span>
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Mode Studio AAO</span>
                </div>
              </div>
              <div class="pt-6">
                <button
                  type="button"
                  (click)="launchApp('patients')"
                  class="w-full py-2.5 px-3 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                  <span>Explorer l'Odontogramme</span>
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;">arrow_forward</mat-icon>
                </button>
              </div>
            </div>

            <!-- Module 2: Bilan Parodontal Normalisé -->
            <div class="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between hover:border-teal-500 transition-all group">
              <div class="space-y-4">
                <div class="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                  <mat-icon style="font-size: 26px; width: 26px; height: 26px;">straighten</mat-icon>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-neutral-900 dark:text-white">Chart Parodontal à 6 Points</h3>
                  <p class="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 leading-relaxed">
                    Sondage parodontal complet (Probing Depth 1 à 12mm), saignement au sondage (BOP), récession gingivale, atteintes de furcation (Classe I-III) et mobilités dentaires.
                  </p>
                </div>
                <div class="flex flex-wrap gap-1.5 text-[11px] font-mono">
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Vestibulaire & Palatin</span>
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">BOP Saignement</span>
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Calculateur d'indice</span>
                </div>
              </div>
              <div class="pt-6">
                <button
                  type="button"
                  (click)="launchApp('patients')"
                  class="w-full py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                  <span>Voir le Bilan Parodontal</span>
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;">arrow_forward</mat-icon>
                </button>
              </div>
            </div>

            <!-- Module 3: Salle d'Attente Connectée -->
            <div class="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between hover:border-amber-500 transition-all group">
              <div class="space-y-4">
                <div class="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-300 flex items-center justify-center">
                  <mat-icon style="font-size: 26px; width: 26px; height: 26px;">meeting_room</mat-icon>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-neutral-900 dark:text-white">Salle d'Attente Connectée Live</h3>
                  <p class="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 leading-relaxed">
                    Gestion en flux tendu : Enregistrement arrivée, chronométrage en direct du temps d'attente, attribution au fauteuil et appel au patient instantané par le praticien.
                  </p>
                </div>
                <div class="flex flex-wrap gap-1.5 text-[11px] font-mono">
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">4 Fauteuils dédiés</span>
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Temps réel synchronisé</span>
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Affichage Salle & Kiosque</span>
                </div>
              </div>
              <div class="pt-6">
                <button
                  type="button"
                  (click)="launchApp('waiting-room')"
                  class="w-full py-2.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                  <span>Accéder à la Salle d'Attente</span>
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;">arrow_forward</mat-icon>
                </button>
              </div>
            </div>

            <!-- Module 4: Agenda Clinique Multi-Praticiens -->
            <div class="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between hover:border-teal-500 transition-all group">
              <div class="space-y-4">
                <div class="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-300 flex items-center justify-center">
                  <mat-icon style="font-size: 26px; width: 26px; height: 26px;">calendar_month</mat-icon>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-neutral-900 dark:text-white">Planning & Agenda Multi-Fauteuils</h3>
                  <p class="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 leading-relaxed">
                    Vues par praticien ou par fauteuil opératoire. Codes couleurs par type de soin (Chirurgie, Endodontie, Détartrage, Contrôle, Prothèse). Rappels automatiques et gestion des urgences.
                  </p>
                </div>
                <div class="flex flex-wrap gap-1.5 text-[11px] font-mono">
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Vue Jour / Semaine</span>
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Filtre Praticiens</span>
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Gestion des disponibilités</span>
                </div>
              </div>
              <div class="pt-6">
                <button
                  type="button"
                  (click)="launchApp('agenda')"
                  class="w-full py-2.5 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                  <span>Consulter l'Agenda Clinique</span>
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;">arrow_forward</mat-icon>
                </button>
              </div>
            </div>

            <!-- Module 5: Actes, CCAM & Règlements -->
            <div class="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between hover:border-teal-500 transition-all group">
              <div class="space-y-4">
                <div class="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                  <mat-icon style="font-size: 26px; width: 26px; height: 26px;">receipt_long</mat-icon>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-neutral-900 dark:text-white">Nomenclature CCAM & Facturation</h3>
                  <p class="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 leading-relaxed">
                    Catalogue d'actes dentaires codifiés (HBGD001, HBFD008, HBLD038...). Tarifs opposables Sécurité Sociale, reste à charge patient, génération de devis normalisés et suivi des encaissements.
                  </p>
                </div>
                <div class="flex flex-wrap gap-1.5 text-[11px] font-mono">
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Cotation simplifiée</span>
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Suivi CB/Chèque/Espèce</span>
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Export comptable</span>
                </div>
              </div>
              <div class="pt-6">
                <button
                  type="button"
                  (click)="launchApp('procedures')"
                  class="w-full py-2.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                  <span>Gérer la Nomenclature</span>
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;">arrow_forward</mat-icon>
                </button>
              </div>
            </div>

            <!-- Module 6: Rapports & Pilotage Clinique -->
            <div class="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between hover:border-teal-500 transition-all group">
              <div class="space-y-4">
                <div class="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300 flex items-center justify-center">
                  <mat-icon style="font-size: 26px; width: 26px; height: 26px;">analytics</mat-icon>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-neutral-900 dark:text-white">Statistiques & Rentabilité du Cabinet</h3>
                  <p class="text-xs text-neutral-600 dark:text-neutral-400 mt-1.5 leading-relaxed">
                    Indicateurs clés de performance : chiffre d'affaires mensuel, taux d'occupation des fauteuils, volume d'actes par praticien, répartition des types de soins et analyse des impayés.
                  </p>
                </div>
                <div class="flex flex-wrap gap-1.5 text-[11px] font-mono">
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Taux d'occupation</span>
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Panier moyen</span>
                  <span class="px-2 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Export CSV / PDF</span>
                </div>
              </div>
              <div class="pt-6">
                <button
                  type="button"
                  (click)="launchApp('reports')"
                  class="w-full py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                  <span>Voir les Statistiques</span>
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;">arrow_forward</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- INTERACTIVE ODONTOGRAM SHOWCASE SECTION -->
      <section id="odontogram" class="py-16 md:py-24 border-b border-neutral-200 dark:border-neutral-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div class="lg:col-span-5 space-y-6">
              <span class="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">Précision Chirurgicale</span>
              <h2 class="text-2xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white leading-tight">
                Une représentation graphique fidèle de chaque arcade dentaire
              </h2>
              <p class="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Visualisez immédiatement l'état bucco-dentaire du patient. Cliquez sur n'importe quelle dent pour sélectionner les surfaces atteintes ou traitées.
              </p>

              <div class="space-y-3">
                <div class="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div class="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                    <mat-icon style="font-size: 18px; width: 18px; height: 18px;">touch_app</mat-icon>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-neutral-900 dark:text-white">Interaction Surface par Surface</h4>
                    <p class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">Occlusale, Mésiale, Distale, Vestibulaire et Linguale/Palatine.</p>
                  </div>
                </div>

                <div class="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div class="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <mat-icon style="font-size: 18px; width: 18px; height: 18px;">swap_horiz</mat-icon>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-neutral-900 dark:text-white">FDI & Universal Switcher</h4>
                    <p class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">Basculez entre la notation internationale FDI (11..48) et le système Universal (1..32) en un clic.</p>
                  </div>
                </div>

                <div class="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <div class="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <mat-icon style="font-size: 18px; width: 18px; height: 18px;">palette</mat-icon>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-neutral-900 dark:text-white">Codes Couleurs Normalisés</h4>
                    <p class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">Rouge pour les caries actives, bleu pour les obturations existantes, or pour les prothèses/couronnes.</p>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  (click)="launchApp('patients')"
                  class="flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-md transition-all">
                  <mat-icon style="font-size: 18px; width: 18px; height: 18px;">dentistry</mat-icon>
                  <span>Tester l'Odontogramme sur un dossier</span>
                </button>
              </div>
            </div>

            <!-- Graphic Preview Card -->
            <div class="lg:col-span-7 bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl">
              <div class="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-6">
                <div>
                  <span class="text-xs font-bold text-neutral-900 dark:text-white">Aperçu Visuel de l'Arcade Maxillaire</span>
                  <p class="text-[11px] text-neutral-500">Cartographie interactive en direct</p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 text-[10px] font-mono bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded font-bold">FDI ISO 3950</span>
                </div>
              </div>

              <!-- Mini Tooth Arch Demo Display -->
              <div class="grid grid-cols-8 gap-2 max-w-lg mx-auto py-4">
                @for (toothNumber of [18, 17, 16, 15, 14, 13, 12, 11]; track toothNumber) {
                  <div class="flex flex-col items-center gap-1 group">
                    <span class="text-[10px] font-mono font-bold text-neutral-400 group-hover:text-teal-600 transition-colors">{{ toothNumber }}</span>
                    <div class="w-9 h-11 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 flex flex-col items-center justify-center p-0.5 group-hover:border-teal-500 group-hover:shadow-sm transition-all cursor-pointer">
                      <div class="w-full h-2 rounded-xs bg-neutral-200 dark:bg-neutral-700 mb-0.5" [class.bg-rose-500]="toothNumber === 16" [class.bg-sky-500]="toothNumber === 14"></div>
                      <div class="w-3.5 h-3.5 rounded-full bg-neutral-200 dark:bg-neutral-700" [class.bg-amber-400]="toothNumber === 17"></div>
                    </div>
                  </div>
                }
              </div>

              <div class="grid grid-cols-8 gap-2 max-w-lg mx-auto py-2">
                @for (toothNumber of [21, 22, 23, 24, 25, 26, 27, 28]; track toothNumber) {
                  <div class="flex flex-col items-center gap-1 group">
                    <div class="w-9 h-11 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 flex flex-col items-center justify-center p-0.5 group-hover:border-teal-500 group-hover:shadow-sm transition-all cursor-pointer">
                      <div class="w-3.5 h-3.5 rounded-full bg-neutral-200 dark:bg-neutral-700" [class.bg-teal-500]="toothNumber === 26"></div>
                      <div class="w-full h-2 rounded-xs bg-neutral-200 dark:bg-neutral-700 mt-0.5" [class.bg-rose-500]="toothNumber === 24"></div>
                    </div>
                    <span class="text-[10px] font-mono font-bold text-neutral-400 group-hover:text-teal-600 transition-colors">{{ toothNumber }}</span>
                  </div>
                }
              </div>

              <!-- Legend -->
              <div class="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-center gap-4 text-[11px] text-neutral-500 flex-wrap">
                <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Carie (16, 24)</span>
                <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span> Obturation (14)</span>
                <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Couronne (17)</span>
                <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Implant (26)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- INTERACTIVE ROI / CHAIR SIMULATOR SECTION -->
      <section id="simulator" class="py-16 md:py-24 bg-neutral-100/70 dark:bg-neutral-900/40 border-b border-neutral-200 dark:border-neutral-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div class="text-center max-w-2xl mx-auto space-y-3">
            <span class="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">Gains Opérationnels</span>
            <h2 class="text-2xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white">Simulateur de Rentabilité du Cabinet</h2>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">Ajustez le nombre de fauteuils dentaires et estimez votre gain de productivité et de temps clinique.</p>
          </div>

          <div class="max-w-4xl mx-auto bg-white dark:bg-neutral-900 p-6 sm:p-10 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-8">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <!-- Sliders -->
              <div class="space-y-6">
                <div>
                  <div class="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                    <span>Nombre de fauteuils dentaires :</span>
                    <span class="text-teal-600 dark:text-teal-400 font-mono text-base">{{ chairCount() }} fauteuils</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    [value]="chairCount()"
                    (input)="onChairCountChange($event)"
                    class="w-full accent-teal-600 cursor-pointer" />
                  <div class="flex justify-between text-[10px] text-neutral-400 font-mono mt-1">
                    <span>1 (Solo)</span>
                    <span>4 (Cabinet standard)</span>
                    <span>10 (Clinique)</span>
                  </div>
                </div>

                <div>
                  <div class="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-2">
                    <span>Patients soignés par jour par fauteuil :</span>
                    <span class="text-teal-600 dark:text-teal-400 font-mono text-base">{{ patientsPerChair() }} patients</span>
                  </div>
                  <input
                    type="range"
                    min="6"
                    max="22"
                    step="1"
                    [value]="patientsPerChair()"
                    (input)="onPatientsPerChairChange($event)"
                    class="w-full accent-teal-600 cursor-pointer" />
                  <div class="flex justify-between text-[10px] text-neutral-400 font-mono mt-1">
                    <span>6 patients</span>
                    <span>14 patients</span>
                    <span>22 patients</span>
                  </div>
                </div>
              </div>

              <!-- Calculated Outputs -->
              <div class="p-6 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-4">
                <div class="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">
                  Gains Estimés avec Denteus
                </div>

                <div class="space-y-3">
                  <div class="flex items-center justify-between border-b border-teal-200/60 dark:border-teal-800/60 pb-2">
                    <span class="text-xs text-neutral-600 dark:text-neutral-300">Temps administratif économisé :</span>
                    <span class="font-bold font-mono text-neutral-900 dark:text-white text-sm">
                      ~{{ hoursSavedPerWeek() }} heures / sem
                    </span>
                  </div>

                  <div class="flex items-center justify-between border-b border-teal-200/60 dark:border-teal-800/60 pb-2">
                    <span class="text-xs text-neutral-600 dark:text-neutral-300">Volume patient annuel fluide :</span>
                    <span class="font-bold font-mono text-neutral-900 dark:text-white text-sm">
                      ~{{ totalAnnualPatients() }} consultations
                    </span>
                  </div>

                  <div class="flex items-center justify-between">
                    <span class="text-xs text-neutral-600 dark:text-neutral-300">Gain d'occupation du fauteuil :</span>
                    <span class="font-bold font-mono text-teal-600 dark:text-teal-400 text-sm">
                      +18% de rentabilité
                    </span>
                  </div>
                </div>

                <div class="pt-2">
                  <button
                    type="button"
                    (click)="launchApp('subscription')"
                    class="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all">
                    Découvrir les offres adaptées à vos {{ chairCount() }} fauteuils
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SECTION: PRICING & SUBSCRIPTION PLANS -->
      <section id="pricing" class="py-16 md:py-24 border-b border-neutral-200 dark:border-neutral-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div class="text-center max-w-2xl mx-auto space-y-3">
            <span class="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">Tarification Claire & Transparente</span>
            <h2 class="text-2xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white">Des formules adaptées à chaque structure</h2>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">Sans engagement de durée, sauvegarde HDS incluse, assistance téléphonique dédiée.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <!-- Plan 1: Praticien Solo -->
            <div class="p-6 sm:p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between hover:shadow-lg transition-all">
              <div class="space-y-4">
                <span class="text-xs font-bold text-neutral-500 uppercase tracking-wider">Praticien Solo</span>
                <div class="flex items-baseline gap-1">
                  <span class="text-4xl font-black text-neutral-900 dark:text-white font-mono">79€</span>
                  <span class="text-xs text-neutral-500">/ mois HT</span>
                </div>
                <p class="text-xs text-neutral-600 dark:text-neutral-400">Idéal pour un praticien exerçant seul avec 1 fauteuil opératoire.</p>

                <div class="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2.5 text-xs text-neutral-700 dark:text-neutral-300">
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> 1 Praticien & 1 Fauteuil</div>
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Odontogramme 3D & FDI</div>
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Bilan Parodontal 6 points</div>
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Salle d'attente connectée</div>
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Sauvegarde HDS 20 Go</div>
                </div>
              </div>
              <div class="pt-8">
                <button
                  type="button"
                  (click)="launchApp('subscription')"
                  class="w-full py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-bold text-xs transition-colors">
                  Sélectionner Solo
                </button>
              </div>
            </div>

            <!-- Plan 2: Cabinet Associé (POPULAR) -->
            <div class="p-6 sm:p-8 rounded-3xl bg-white dark:bg-neutral-900 border-2 border-teal-500 flex flex-col justify-between shadow-xl relative">
              <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-teal-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                Le Plus Choisi
              </div>
              <div class="space-y-4">
                <span class="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Cabinet Partagé</span>
                <div class="flex items-baseline gap-1">
                  <span class="text-4xl font-black text-neutral-900 dark:text-white font-mono">149€</span>
                  <span class="text-xs text-neutral-500">/ mois HT</span>
                </div>
                <p class="text-xs text-neutral-600 dark:text-neutral-400">Pour 2 à 4 praticiens partageant salle d'attente, assistantes et plateau technique.</p>

                <div class="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2.5 text-xs text-neutral-700 dark:text-neutral-300">
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Jusqu'à 4 Fauteuils inclus</div>
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Dossiers patients partagés & sécurisés</div>
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Planning multi-praticiens & rappels</div>
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Odontogramme & Bilan Paro illimité</div>
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Sauvegarde HDS 100 Go & Audit</div>
                </div>
              </div>
              <div class="pt-8">
                <button
                  type="button"
                  (click)="launchApp('subscription')"
                  class="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/25 transition-all">
                  Choisir Cabinet Partagé
                </button>
              </div>
            </div>

            <!-- Plan 3: Clinique & Centre Dentaire -->
            <div class="p-6 sm:p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between hover:shadow-lg transition-all">
              <div class="space-y-4">
                <span class="text-xs font-bold text-neutral-500 uppercase tracking-wider">Clinique & Groupe</span>
                <div class="flex items-baseline gap-1">
                  <span class="text-4xl font-black text-neutral-900 dark:text-white font-mono">299€</span>
                  <span class="text-xs text-neutral-500">/ mois HT</span>
                </div>
                <p class="text-xs text-neutral-600 dark:text-neutral-400">Pour centres dentaires, cliniques mutualistes et cabinets de groupe.</p>

                <div class="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2.5 text-xs text-neutral-700 dark:text-neutral-300">
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Fauteuils illimités</div>
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Multi-sites & Multi-cliniques</div>
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Rôles et droits d'accès granulaires</div>
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Piste d'audit légale complète</div>
                  <div class="flex items-center gap-2"><mat-icon class="text-teal-600 text-sm">check</mat-icon> Support dédié 24/7 & HDS 1 To</div>
                </div>
              </div>
              <div class="pt-8">
                <button
                  type="button"
                  (click)="launchApp('subscription')"
                  class="w-full py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-bold text-xs transition-colors">
                  Sélectionner Clinique
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SECURITY & COMPLIANCE -->
      <section id="security" class="py-16 bg-neutral-100/60 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="max-w-3xl mx-auto text-center space-y-4">
            <div class="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 mx-auto flex items-center justify-center">
              <mat-icon style="font-size: 26px; width: 26px; height: 26px;">security</mat-icon>
            </div>
            <h3 class="text-2xl font-bold text-neutral-900 dark:text-white">Sécurité de Niveau Bancaire & Médical</h3>
            <p class="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Toutes les données de vos patients sont hébergées en France sur des serveurs certifiés <strong>HDS (Hébergement de Données de Santé)</strong> et conformes à la norme <strong>ISO 27001</strong>. Les communications sont chiffrées de bout en bout en TLS 1.3 / AES-256 et chaque consultation fait l'objet d'un journal d'audit immuable.
            </p>
            <div class="pt-2">
              <button
                type="button"
                (click)="launchApp('audit-trail')"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 transition-colors">
                <mat-icon style="font-size: 16px; width: 16px; height: 16px;">lock</mat-icon>
                <span>Consulter la Piste d'Audit du Cabinet</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="bg-white dark:bg-neutral-950 py-12 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-base">
              D
            </div>
            <div>
              <span class="font-bold text-neutral-900 dark:text-white text-sm">Denteus Cloud</span>
              <p class="text-[11px] text-neutral-400">© {{ currentYear }} Denteus Dental Technologies Inc. Tous droits réservés.</p>
            </div>
          </div>

          <div class="flex items-center gap-6">
            <button (click)="launchApp('dashboard')" class="hover:text-teal-600 transition-colors">Espace Praticien</button>
            <button (click)="launchApp('waiting-room')" class="hover:text-teal-600 transition-colors">Salle d'attente</button>
            <button (click)="launchApp('clinic-settings')" class="hover:text-teal-600 transition-colors">Paramètres</button>
            <button (click)="launchApp('subscription')" class="hover:text-teal-600 transition-colors">Abonnement</button>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class HomeLandingComponent {
  readonly i18n = inject(I18nService);
  readonly themeService = inject(ThemeService);
  readonly tenantService = inject(TenantService);
  readonly dataService = inject(DentalDataService);

  readonly navigateTo = output<NavigationTab>();

  readonly chairCount = signal<number>(4);
  readonly patientsPerChair = signal<number>(12);
  readonly currentYear = new Date().getFullYear();

  onChairCountChange(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value)) {
      this.chairCount.set(value);
    }
  }

  onPatientsPerChairChange(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value)) {
      this.patientsPerChair.set(value);
    }
  }

  hoursSavedPerWeek(): number {
    return Math.round(this.chairCount() * 3.5);
  }

  totalAnnualPatients(): number {
    return this.chairCount() * this.patientsPerChair() * 220;
  }

  launchApp(tab: NavigationTab): void {
    this.navigateTo.emit(tab);
  }
}
