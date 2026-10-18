import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CalendarViewType } from '../../models/calendar.models';
import { CalendarStore } from '../../services/calendar-store.service';
import { CalIconComponent } from '../cal-icon/cal-icon.component';

@Component({
  selector: 'cal-toolbar',
  imports: [CalIconComponent],
  templateUrl: './calendar-toolbar.component.html',
  styleUrl: './calendar-toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarToolbarComponent {
  protected readonly store = inject(CalendarStore);

  readonly searchPlaceholder = input('Rechercher');
  readonly showThemeToggle = input(true);
  readonly newLabel = input('New event');
  readonly newEvent = output<void>();
  readonly toggleSidebar = output<void>();
  readonly toggleTheme = output<void>();

  protected readonly views: { id: CalendarViewType; label: string }[] = [
    { id: 'day', label: 'Jour' },
    { id: 'week', label: 'Semaine' },
    { id: 'month', label: 'Mois' },
    { id: 'year', label: 'Année' },
  ];

  protected onSearch(event: Event): void {
    this.store.search.set((event.target as HTMLInputElement).value);
  }
}
