import type { FastifyPluginAsync } from 'fastify';
import { requireClinicAccess } from '../auth/authorization.js';
import { pool } from '../db/pool.js';

interface Params { organizationId: string; clinicId: string; }
interface PeriodQuery { from: string; to: string; }

const periodSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['from', 'to'],
  properties: {
    from: { type: 'string', format: 'date' },
    to: { type: 'string', format: 'date' },
  },
} as const;

function validPeriod(from: string, to: string): boolean {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) && start <= end &&
    end - start <= 366 * 24 * 60 * 60 * 1000 &&
    new Date(start).toISOString().slice(0, 10) === from &&
    new Date(end).toISOString().slice(0, 10) === to;
}

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: Params; Querystring: PeriodQuery }>(
    '/organizations/:organizationId/clinics/:clinicId/reports/overview',
    { schema: { querystring: periodSchema } },
    async (request, reply) => {
      const { organizationId, clinicId } = request.params;
      const access = await requireClinicAccess(request, reply, organizationId, clinicId);
      if (!access) return;

      const { from, to } = request.query;
      if (!validPeriod(from, to)) {
        return reply.code(400).send({
          error: { code: 'INVALID_REPORT_PERIOD', message: 'Choisissez une période valide de 367 jours maximum.' },
        });
      }

      const [appointments, patients, recalls, trend] = await Promise.all([
        pool.query(
          `SELECT a.status, count(*)::integer AS count
           FROM appointments a
           JOIN clinics c ON c.organization_id = a.organization_id AND c.id = a.clinic_id
           WHERE a.organization_id = $1 AND a.clinic_id = $2
             AND (a.starts_at AT TIME ZONE c.timezone) >= $3::date::timestamp
             AND (a.starts_at AT TIME ZONE c.timezone) < ($4::date + interval '1 day')::timestamp
           GROUP BY a.status`,
          [organizationId, clinicId, from, to],
        ),
        pool.query(
          `SELECT count(*)::integer AS total,
                  count(*) FILTER (WHERE (p.created_at AT TIME ZONE c.timezone) >= $3::date::timestamp
                    AND (p.created_at AT TIME ZONE c.timezone) < ($4::date + interval '1 day')::timestamp)::integer AS added
           FROM patient_clinics pc
           JOIN patients p ON p.organization_id = pc.organization_id AND p.id = pc.patient_id
           JOIN clinics c ON c.organization_id = pc.organization_id AND c.id = pc.clinic_id
           WHERE pc.organization_id = $1 AND pc.clinic_id = $2`,
          [organizationId, clinicId, from, to],
        ),
        pool.query(
          `SELECT count(*) FILTER (WHERE r.status = 'DUE' AND r.due_on <= $4::date)::integer AS overdue,
                  count(*) FILTER (WHERE r.status = 'DUE' AND r.due_on >= $3::date AND r.due_on <= $4::date)::integer AS due_in_period,
                  count(*) FILTER (WHERE r.status = 'COMPLETED' AND (r.updated_at AT TIME ZONE c.timezone) >= $3::date::timestamp
                    AND (r.updated_at AT TIME ZONE c.timezone) < ($4::date + interval '1 day')::timestamp)::integer AS completed
           FROM patient_recalls r
           JOIN clinics c ON c.organization_id = r.organization_id AND c.id = r.clinic_id
           WHERE r.organization_id = $1 AND r.clinic_id = $2`,
          [organizationId, clinicId, from, to],
        ),
        pool.query(
          `SELECT to_char((a.starts_at AT TIME ZONE c.timezone)::date, 'YYYY-MM-DD') AS day,
                  count(*)::integer AS total,
                  count(*) FILTER (WHERE a.status = 'COMPLETED')::integer AS completed,
                  count(*) FILTER (WHERE a.status = 'CANCELLED')::integer AS cancelled,
                  count(*) FILTER (WHERE a.status = 'NO_SHOW')::integer AS no_show
           FROM appointments a
           JOIN clinics c ON c.organization_id = a.organization_id AND c.id = a.clinic_id
           WHERE a.organization_id = $1 AND a.clinic_id = $2
             AND (a.starts_at AT TIME ZONE c.timezone) >= $3::date::timestamp
             AND (a.starts_at AT TIME ZONE c.timezone) < ($4::date + interval '1 day')::timestamp
           GROUP BY (a.starts_at AT TIME ZONE c.timezone)::date
           ORDER BY (a.starts_at AT TIME ZONE c.timezone)::date`,
          [organizationId, clinicId, from, to],
        ),
      ]);

      const appointmentCounts = Object.fromEntries(
        appointments.rows.map((row: { status: string; count: number }) => [row.status, row.count]),
      ) as Record<string, number>;
      const totalAppointments = Object.values(appointmentCounts).reduce((sum, count) => sum + count, 0);
      const completed = appointmentCounts['COMPLETED'] ?? 0;
      const cancelled = appointmentCounts['CANCELLED'] ?? 0;
      const noShow = appointmentCounts['NO_SHOW'] ?? 0;
      const scheduledDenominator = totalAppointments - cancelled;
      return {
        data: {
          period: { from, to },
          appointments: {
            total: totalAppointments,
            byStatus: appointmentCounts,
            completed,
            cancelled,
            noShow,
            completionRate: scheduledDenominator > 0 ? Math.round((completed / scheduledDenominator) * 1000) / 10 : null,
          },
          patients: patients.rows[0] ?? { total: 0, added: 0 },
          recalls: recalls.rows[0] ?? { overdue: 0, due_in_period: 0, completed: 0 },
          trend: trend.rows,
        },
      };
    },
  );
};
