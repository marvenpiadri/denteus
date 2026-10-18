import { AgendaCalendarComponent } from './agenda-calendar.component';
import type { AppointmentRecord } from './appointment-api.service';

function appointment(id: string, startsAt: string, endsAt: string): AppointmentRecord {
  return {
    id, organizationId: 'org-1', clinicId: 'clinic-1', patientId: `patient-${id}`,
    patientNumber: `DEN-${id}`, patientFirstName: 'Test', patientLastName: id,
    startsAt, endsAt, status: 'SCHEDULED', reason: null,
    providerId: null, providerName: null, operatoryId: null, operatoryName: null,
    createdById: 'user-1', createdAt: startsAt, updatedAt: startsAt,
  };
}

describe('AgendaCalendarComponent', () => {
  it('positions an appointment by its actual clinic-local start minute and duration', () => {
    const component = new AgendaCalendarComponent();
    component.date = '2026-10-18';
    component.timeZone = 'Africa/Casablanca';
    component.appointments = [
      appointment('one', '2026-10-18T09:15:00.000Z', '2026-10-18T09:45:00.000Z'),
    ];

    const positioned = component.positionedAppointments(component.defaultColumn());
    expect(positioned).toHaveLength(1);
    expect(positioned[0]?.topPx).toBe(195);
    expect(positioned[0]?.heightPx).toBe(30);
  });

  it('splits overlapping appointment cards into visible side-by-side lanes', () => {
    const component = new AgendaCalendarComponent();
    component.date = '2026-10-18';
    component.timeZone = 'Africa/Casablanca';
    component.appointments = [
      appointment('one', '2026-10-18T09:00:00.000Z', '2026-10-18T10:00:00.000Z'),
      appointment('two', '2026-10-18T09:30:00.000Z', '2026-10-18T10:30:00.000Z'),
    ];

    const positioned = component.positionedAppointments(component.columns()[0]);
    expect(positioned).toHaveLength(2);
    expect(positioned.map((item) => item.leftPct)).toEqual([0, 50]);
    expect(positioned.every((item) => item.widthPct < 50)).toBe(true);
  });

  it('emits a snapped local start time when an active appointment is dropped', () => {
    const component = new AgendaCalendarComponent();
    component.date = '2026-10-18';
    component.timeZone = 'Africa/Casablanca';
    const record = appointment('move-me', '2026-10-18T09:15:00.000Z', '2026-10-18T09:45:00.000Z');
    const lane = { getBoundingClientRect: () => ({ top: 100 }) };
    const event = {
      item: { data: record },
      container: { element: { nativeElement: lane } },
      dropPoint: { x: 200, y: 100 + 14 + 240 },
    };
    let emitted: { appointment: AppointmentRecord; startsAt: string } | undefined;
    component.appointmentDropped.subscribe((change) => { emitted = change; });

    component.onAppointmentDrop(event as never, component.defaultColumn());

    expect(emitted?.appointment.id).toBe('move-me');
    expect(emitted?.startsAt).toBe('2026-10-18T11:00');
  });

  it('does not show events from a different clinic-local date in this day view', () => {
    const component = new AgendaCalendarComponent();
    component.date = '2026-10-18';
    component.timeZone = 'Africa/Casablanca';
    component.appointments = [
      appointment('previous-day', '2026-10-17T09:00:00.000Z', '2026-10-17T09:30:00.000Z'),
    ];

    expect(component.positionedAppointments(component.columns()[0])).toHaveLength(0);
  });
});
