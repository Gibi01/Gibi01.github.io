import CalendarioTurnosMovil from './CalendarioTurnosMovil';
import { useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import luxonPlugin from '@fullcalendar/luxon3';
import esLocale from '@fullcalendar/core/locales/es';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import type { DatesSetArg } from '@fullcalendar/core';
import type { Turno, TurnoParaDoctor } from '../Tipos/dominio';
import './calendario.css';

import { estadosTurno } from '../Tipos/dominio';
const colores = { pendiente: '#0277BD', cancelado: '#616161', asistido: '#2E7D32', no_asistido: '#8D6700' };
export default function CalendarioTurnosReservados({ turnos, medico, onRango, onSeleccionar, cargando = false }: {
  cargando?: boolean; turnos: Turno[]; medico: boolean; onRango: (rango: { desde: string; hasta: string }) => void; onSeleccionar: (turno: Turno) => void;
}) {
  const movil = useMediaQuery(useTheme().breakpoints.down('sm'));
  const calendario = useRef<FullCalendar>(null);
  useEffect(() => { calendario.current?.getApi().changeView(movil ? 'timeGridDay' : medico ? 'timeGridWeek' : 'dayGridMonth'); }, [movil, medico]);
  if (movil) return <CalendarioTurnosMovil turnos={turnos} medico={medico} onRango={onRango} onSeleccionar={onSeleccionar} cargando={cargando} />;
  const eventos = turnos.map(t => ({
    id: String(t.id), start: t.fechaHoraTurno,
    end: t.duracionTurnoMinutos ? new Date(+new Date(t.fechaHoraTurno) + t.duracionTurnoMinutos * 60000).toISOString() : undefined,
    title: `${medico ? `${(t as TurnoParaDoctor).paciente?.nombre ?? ''} ${(t as TurnoParaDoctor).paciente?.apellido ?? ''}` : `Dr./Dra. ${t.doctor.nombre} ${t.doctor.apellido}`} · ${estadosTurno[t.estado]}${!t.duracionTurnoMinutos ? ' · Duración por verificar' : ''}`,
    backgroundColor: colores[t.estado], borderColor: colores[t.estado],
  }));
  return <Box className="calendario" aria-label={medico ? 'Calendario de turnos a atender' : 'Calendario de mis turnos'}>
    <FullCalendar ref={calendario} plugins={[dayGridPlugin, timeGridPlugin, luxonPlugin]} locale={esLocale}
      timeZone="America/Argentina/Buenos_Aires" firstDay={1} initialView={movil ? 'timeGridDay' : medico ? 'timeGridWeek' : 'dayGridMonth'}
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
      height={movil ? 620 : 740} slotMinTime="00:00:00" slotMaxTime="24:00:00" scrollTime="08:00:00" allDaySlot={false}
      editable={false} selectable={false} eventStartEditable={false} eventDurationEditable={false} eventInteractive
      slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }} dayMaxEvents={3} events={eventos}
      datesSet={(arg: DatesSetArg) => onRango({ desde: arg.startStr, hasta: arg.endStr })}
      eventClick={({ event }) => { const turno = turnos.find(t => String(t.id) === event.id); if (turno) onSeleccionar(turno); }} />
  </Box>;
}
